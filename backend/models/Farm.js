const mongoose = require('mongoose');

const FarmSchema = new mongoose.Schema({
  // Owner who registered this farm
  ownerId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:             { type: String, required: true, trim: true },
  location:         { type: String, default: '' },
  areaSize:         { type: Number, default: 0 },
  soilType:         { type: String, default: '' },
  irrigationMethod: { type: String, default: '' },

  // ── Crop profile ─────────────────────────────────────────────────────────
  cropType:    { type: String, default: '' },
  cropVariety: { type: String, default: '' },
  plantingDate:        { type: Date },
  expectedHarvestDate: { type: Date },
  growthStage: {
    type: String,
    enum: ['seed', 'germination', 'vegetative', 'flowering', 'fruiting', 'harvest', 'fallow', ''],
    default: '',
  },

  // Kc coefficients for ET0 evapotranspiration
  kcInitial: { type: Number, default: 0.6 },
  kcMid:     { type: Number, default: 1.0 },
  kcEnd:     { type: Number, default: 0.8 },

  // ── GPS (legacy simple lat/lng) ──────────────────────────────────────────
  gps: {
    lat: { type: Number },
    lng: { type: Number },
  },

  // ── GeoJSON Point for 2dsphere geospatial index ──────────────────────────
  geoLocation: {
    type:        { type: String, enum: ['Point'] },
    coordinates: { type: [Number] }, // [lng, lat]
  },
}, { timestamps: true }); // adds createdAt AND updatedAt — removed manual createdAt field

// ── Indexes ────────────────────────────────────────────────────────────────
// 2dsphere index enables $near, $within, and $geoIntersects queries
FarmSchema.index({ geoLocation: '2dsphere' }, { sparse: true });
FarmSchema.index({ ownerId: 1 });

// Auto-sync GeoJSON from gps fields on every save
FarmSchema.pre('save', function () {
  if (
    this.gps?.lat != null && this.gps?.lng != null &&
    !isNaN(Number(this.gps.lat)) && !isNaN(Number(this.gps.lng))
  ) {
    this.geoLocation = {
      type: 'Point',
      coordinates: [Number(this.gps.lng), Number(this.gps.lat)],
    };
  } else {
    this.geoLocation = undefined;
  }
});

module.exports = mongoose.model('Farm', FarmSchema);
