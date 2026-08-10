const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  phone:    { type: String, default: '' },
  password: { type: String },
  googleId: { type: String, unique: true, sparse: true },
  avatar:   { type: String, default: '' },

  role: {
    type: String,
    enum: ['super_administrator', 'office_manager', 'farmer', 'labor'],
    default: 'farmer',
  },

  farmId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
  language: { type: String, default: 'en' },

  // Account status
  isActive:    { type: Boolean, default: true },
  suspendedAt: { type: Date },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  suspendReason: { type: String, default: '' },

  // Automation thresholds (used by farmer / admin)
  lowMoistureThreshold:     { type: Number, default: 30 },
  optimalMoistureThreshold: { type: Number, default: 70 },

  // Token management
  refreshToken:        { type: String, select: false },
  refreshTokenExpires: { type: Date },
  resetPasswordToken:  { type: String },
  resetPasswordExpires:{ type: Date },
  magicLinkToken:      { type: String },
  magicLinkExpires:    { type: Date },

  // Notification preferences
  notifyEmail:       { type: Boolean, default: true },
  notifyLowMoisture: { type: Boolean, default: true },
  notifyTankEmpty:   { type: Boolean, default: true },
  notifyPumpAuto:    { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
});

UserSchema.pre('save', async function () {
  if (!this.password || !this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
