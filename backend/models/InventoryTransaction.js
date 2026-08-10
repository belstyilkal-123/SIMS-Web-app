const mongoose = require('mongoose');

/**
 * InventoryTransaction — audit trail of every stock movement:
 * restock, consumption, transfer, adjustment, write-off.
 */
const InventoryTransactionSchema = new mongoose.Schema({
  itemId:   { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  farmId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
  type:     {
    type: String,
    enum: ['restock', 'consume', 'transfer', 'adjustment', 'write_off'],
    required: true,
  },
  quantity: { type: Number, required: true },          // positive = in, negative = out
  quantityBefore: { type: Number, required: true },
  quantityAfter:  { type: Number, required: true },
  unitCost:       { type: Number, default: 0 },
  totalCost:      { type: Number, default: 0 },
  reference:      { type: String, default: '' },       // PO number, task id, etc.
  notes:          { type: String, default: '' },
  performedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

InventoryTransactionSchema.index({ itemId: 1, createdAt: -1 });
InventoryTransactionSchema.index({ farmId: 1, type: 1 });

module.exports = mongoose.model('InventoryTransaction', InventoryTransactionSchema);
