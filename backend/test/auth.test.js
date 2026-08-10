/**
 * Auth route integration tests
 * Tests: register, login, forgot-password, profile
 * Uses in-memory mongoose (mocked) via jest — no real DB needed.
 */

const request  = require('supertest');
const mongoose = require('mongoose');
const express  = require('express');
const jwt      = require('jsonwebtoken');

// ── Minimal app setup (no full server.js to avoid cron/socket side-effects) ──
const app = express();
app.use(express.json());

process.env.JWT_SECRET     = 'test_secret_key_for_jest';
process.env.MONGODB_URI    = '';  // not used; we mock mongoose ops

// ── Mock User model ───────────────────────────────────────────────────────────
jest.mock('../models/User', () => {
  const users = [];
  const mockUser = function (data) {
    Object.assign(this, data);
    this._id      = `mock_id_${Date.now()}`;
    this.role     = data.role || 'farmer';
    this.language = data.language || 'en';
    this.createdAt = new Date();
  };
  mockUser.findOne  = jest.fn(({ email } = {}) => Promise.resolve(users.find(u => u.email === email) || null));
  mockUser.findById = jest.fn((id) => Promise.resolve(users.find(u => u._id === id) || null));
  mockUser.findByIdAndUpdate = jest.fn(() => Promise.resolve(null)); // for saveRefreshToken
  mockUser.create   = jest.fn(async (data) => {
    const u = { ...data, _id: `id_${Date.now()}`, role: data.role || 'farmer', language: data.language || 'en', isActive: true, createdAt: new Date() };
    u.matchPassword = async (pw) => pw === data.password;
    users.push(u);
    return u;
  });
  mockUser.prototype.save = jest.fn(async function () { return this; });
  mockUser.updateOne = jest.fn(() => Promise.resolve({ nModified: 1 }));
  return mockUser;
});

app.use('/api/auth', require('../routes/auth'));
app.use(require('../middleware/errorHandler'));

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('returns 201 with token on valid data', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Farmer', email: 'farmer@test.com', password: 'securepass1'
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.role).toBe('farmer'); // public reg always gives farmer
  });

  it('returns 400 if email is missing', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'No Email', password: 'password123'
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 if password too short', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Short Pw', email: 'short@test.com', password: '123'
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 if user already exists', async () => {
    const email = 'dup@test.com';
    const User  = require('../models/User');
    User.findOne.mockResolvedValueOnce({ _id: 'existing', email });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Dup', email, password: 'password123'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 with token on valid credentials', async () => {
    const User = require('../models/User');
    User.findOne.mockResolvedValueOnce({
      _id: 'uid1', name: 'Farmer', email: 'f@farm.com',
      role: 'farmer', language: 'en',
      matchPassword: async () => true, isActive: true,
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'f@farm.com', password: 'correct_password'
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 401 on wrong password', async () => {
    const User = require('../models/User');
    User.findOne.mockResolvedValueOnce({
      _id: 'uid2', name: 'X', email: 'x@x.com',
      matchPassword: async () => false, isActive: true,
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'x@x.com', password: 'wrong'
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when user not found', async () => {
    const User = require('../models/User');
    User.findOne.mockResolvedValueOnce(null);

    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@x.com', password: 'pass'
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'not-an-email', password: 'pass'
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('returns generic message even for unknown email (no enumeration)', async () => {
    const User = require('../models/User');
    User.findOne.mockResolvedValueOnce(null);

    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'ghost@x.com'
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if that email/i);
  });
});

describe('GET /api/auth/profile', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  it('returns user profile with valid token', async () => {
    const token = jwt.sign({ id: 'uid_profile' }, process.env.JWT_SECRET);
    const User  = require('../models/User');
    // protect middleware calls User.findById().select('-password')
    User.findById
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue({ _id: 'uid_profile', name: 'Profile User', isActive: true, email: 'p@p.com', role: 'farmer', language: 'en' }) }) // protect middleware
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue({ _id: 'uid_profile', name: 'Profile User', isActive: true, email: 'p@p.com', role: 'farmer', language: 'en' }) }); // profile route

    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Profile User');
  });
});

