const mongoose = require('mongoose');

const FarmSchema = new mongoose.Schema({
  ownerId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:             { type: String, required: true },
  location:         { type: String },
  areaSize:         { type: Number },
  soilType:         { type: String },
  irrigationMethod: { type: String },

  // ── Crop profile ─────────────────────────────────────────────
  cropType:    { type: String, default: '' },
  cropVariety: { type: String, default: '' },
  plantingDate:        { type: Date },
  expectedHarvestDate: { type: Date },
  growthStage: {
    type: String,
    enum: ['seed','germination','vegetative','flowering','fruiting','harvest','fallow',''],
    default: '',
  },
  // Kc coefficients for ET0 evapotranspiration
  kcInitial: { type: Number, default: 0.6 },
  kcMid:     { type: Number, default: 1.0 },
  kcEnd:     { type: Number, default: 0.8 },

  // ── GPS (legacy simple lat/lng) ──────────────────────────────
  gps: {
    lat: { type: Number },
    lng: { type: Number },
  },

  // ── GeoJSON Point for 2dsphere geospatial index ──────────────
  geoLocation: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }, // [lng, lat]
  },

  createdAt: { type: Date, default: Date.now },
});

// 2dsphere index enables $near, $within, and $geoIntersects queries
FarmSchema.index({ geoLocation: '2dsphere' });
FarmSchema.index({ ownerId: 1 });

// Auto-sync GeoJSON from gps fields on every save
FarmSchema.pre('save', function () {
  if (this.gps?.lat != null && this.gps?.lng != null) {
    this.geoLocation = {
      type: 'Point',
      coordinates: [Number(this.gps.lng), Number(this.gps.lat)],
    };
  }
});

module.exports = mongoose.model('Farm', FarmSchema);
