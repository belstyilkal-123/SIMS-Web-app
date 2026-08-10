const express = require('express');
const router  = express.Router();
const InventoryItem        = require('../models/InventoryItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const { protect, authorize } = require('../middleware/authMiddleware');

const SA   = 'super_administrator';
const OM   = 'office_manager';
const MGMT = [SA, OM];

/* ══════════════════════════════════════════════════════════════════
   INVENTORY ITEMS
══════════════════════════════════════════════════════════════════ */

// ── GET /api/inventory ────────────────────────────────────────────
router.get('/', protect, authorize(...MGMT), async (req, res) => {
  try {
    const { farmId, category, lowStock, search } = req.query;
    const query = { isActive: true };

    if (farmId)   query.farmId   = farmId;
    if (category) query.category = category;
    if (lowStock === 'true') {
      // Items at or below reorder level
      query.$expr = { $lte: ['$quantity', '$reorderLevel'] };
    }
    if (search) {
      query.$or = [
        { name:     { $regex: search, $options: 'i' } },
        { sku:      { $regex: search, $options: 'i' } },
        { supplier: { $regex: search, $options: 'i' } },
      ];
    }

    const items = await InventoryItem.find(query)
      .populate('farmId',          'name')
      .populate('lastRestockedBy', 'name')
      .sort({ category: 1, name: 1 });

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory', details: err.message });
  }
});

// ── GET /api/inventory/summary ────────────────────────────────────
router.get('/summary', protect, authorize(...MGMT), async (req, res) => {
  try {
    const { farmId } = req.query;
    const match = { isActive: true };
    if (farmId) match.farmId = require('mongoose').Types.ObjectId.createFromHexString(farmId);

    const [byCategory, lowStock] = await Promise.all([
      InventoryItem.aggregate([
        { $match: match },
        { $group: {
          _id:        '$category',
          totalItems: { $sum: 1 },
          totalQty:   { $sum: '$quantity' },
          totalValue: { $sum: '$totalValue' },
        }},
        { $sort: { _id: 1 } },
      ]),
      InventoryItem.countDocuments({
        ...match,
        $expr: { $lte: ['$quantity', '$reorderLevel'] },
      }),
    ]);

    const totalValue = byCategory.reduce((s, c) => s + c.totalValue, 0);
    res.json({ byCategory, lowStock, totalValue });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch summary', details: err.message });
  }
});

// ── GET /api/inventory/:id ────────────────────────────────────────
router.get('/:id', protect, authorize(...MGMT), async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id)
      .populate('farmId',          'name')
      .populate('lastRestockedBy', 'name email');
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch item', details: err.message });
  }
});

// ── POST /api/inventory — create item ────────────────────────────
router.post('/', protect, authorize(...MGMT), async (req, res) => {
  try {
    const { name, sku, category, unit, quantity, reorderLevel,
      unitCost, supplier, location, description, farmId } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const item = await InventoryItem.create({
      name, sku, category, unit,
      quantity:     Number(quantity     || 0),
      reorderLevel: Number(reorderLevel || 5),
      unitCost:     Number(unitCost     || 0),
      supplier, location, description,
      farmId: farmId || undefined,
      lastRestockedAt: quantity > 0 ? new Date() : undefined,
      lastRestockedBy: quantity > 0 ? req.user._id : undefined,
    });

    // Record opening stock transaction
    if (item.quantity > 0) {
      await InventoryTransaction.create({
        itemId: item._id, farmId: item.farmId,
        type: 'restock', quantity: item.quantity,
        quantityBefore: 0, quantityAfter: item.quantity,
        unitCost: item.unitCost, totalCost: item.totalValue,
        notes: 'Opening stock', performedBy: req.user._id,
      });
    }

    await item.populate('farmId', 'name');
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create item', details: err.message });
  }
});

// ── PUT /api/inventory/:id — update item details (not quantity) ──
router.put('/:id', protect, authorize(...MGMT), async (req, res) => {
  try {
    const allowed = ['name','sku','category','unit','reorderLevel',
      'unitCost','supplier','location','description','farmId','isActive'];
    const update = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    const item = await InventoryItem.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    ).populate('farmId', 'name');
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item', details: err.message });
  }
});

// ── DELETE /api/inventory/:id — soft delete ──────────────────────
router.delete('/:id', protect, authorize(SA), async (req, res) => {
  try {
    const item = await InventoryItem.findByIdAndUpdate(
      req.params.id, { isActive: false }, { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate item', details: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   STOCK MOVEMENTS  (adjust quantity + create transaction)
══════════════════════════════════════════════════════════════════ */

// ── POST /api/inventory/:id/adjust — restock, consume, adjust ────
router.post('/:id/adjust', protect, authorize(...MGMT), async (req, res) => {
  try {
    const { type, quantity, unitCost, reference, notes } = req.body;
    const validTypes = ['restock','consume','adjustment','write_off'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }
    if (!quantity || quantity === 0) {
      return res.status(400).json({ error: 'quantity must be non-zero' });
    }

    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const qtyBefore = item.quantity;
    const delta     = ['consume','write_off'].includes(type)
      ? -Math.abs(Number(quantity))
      :  Math.abs(Number(quantity));
    const qtyAfter  = Math.max(0, qtyBefore + delta);

    item.quantity = qtyAfter;
    if (type === 'restock') {
      item.lastRestockedAt = new Date();
      item.lastRestockedBy = req.user._id;
      if (unitCost) item.unitCost = Number(unitCost);
    }
    await item.save();

    const tx = await InventoryTransaction.create({
      itemId:         item._id,
      farmId:         item.farmId,
      type,
      quantity:       delta,
      quantityBefore: qtyBefore,
      quantityAfter:  qtyAfter,
      unitCost:       Number(unitCost || item.unitCost),
      totalCost:      parseFloat((Math.abs(delta) * Number(unitCost || item.unitCost)).toFixed(2)),
      reference:      reference || '',
      notes:          notes     || '',
      performedBy:    req.user._id,
    });

    res.json({ item, transaction: tx });
  } catch (err) {
    res.status(500).json({ error: 'Failed to adjust stock', details: err.message });
  }
});

// ── GET /api/inventory/:id/transactions — movement history ────────
router.get('/:id/transactions', protect, authorize(...MGMT), async (req, res) => {
  try {
    const txs = await InventoryTransaction.find({ itemId: req.params.id })
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions', details: err.message });
  }
});

module.exports = router;
