const mongoose = require('mongoose');

/**
 * InventoryItem — tracks physical assets and consumables:
 * pumps, pipes, sensors, valves, spare parts, chemicals, etc.
 */
const InventoryItemSchema = new mongoose.Schema({
  farmId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' }, // null = central/global stock
  name:     { type: String, required: true, trim: true },
  sku:      { type: String, default: '', trim: true },             // stock-keeping unit / part number
  category: {
    type: String,
    enum: ['pump','pipe','sensor','valve','filter','electrical',
      'chemical','fertilizer','spare_part','tool','other'],
    default: 'other',
  },
  unit:     { type: String, default: 'unit' },   // e.g. unit, kg, litre, metre
  quantity: { type: Number, default: 0, min: 0 },
  reorderLevel: { type: Number, default: 5, min: 0 }, // alert when quantity ≤ this

  unitCost:   { type: Number, default: 0, min: 0 },  // ETB per unit
  totalValue: { type: Number, default: 0, min: 0 },  // computed on save

  supplier:    { type: String, default: '' },
  location:    { type: String, default: '' },  // e.g. "Warehouse A, Shelf 3"
  description: { type: String, default: '' },

  lastRestockedAt: { type: Date },
  lastRestockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

/* auto-compute total value */
InventoryItemSchema.pre('save', function () {
  this.totalValue = parseFloat((this.quantity * this.unitCost).toFixed(2));
});

InventoryItemSchema.index({ farmId: 1, category: 1 });
InventoryItemSchema.index({ category: 1, quantity: 1 });

module.exports = mongoose.model('InventoryItem', InventoryItemSchema);
