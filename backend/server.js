const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const dotenv     = require('dotenv');
const http       = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const morgan     = require('morgan');
const deviceAuth = require('./middleware/deviceAuth');

dotenv.config();

// ── Allowed origins for CORS ──────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST']
  }
});

// Attach socket.io to the app so routes can access it if needed
app.set('io', io);

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

// ── Security middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ── Request logging (Morgan) ──────────────────────────────────
// 'dev' format: METHOD /path STATUS time — concise for development
// In production swap to 'combined' and pipe to a log file / service
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Rate limiters ─────────────────────────────────────────────
// Auth routes: 20 attempts per 15 minutes in production, 200 in dev
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // successful logins don't count against the limit
  message: {
    error: 'Too many login attempts. Please wait 15 minutes before trying again.',
    error_am: 'ብዙ ሙከራዎች። እባክዎ ከ15 ደቂቃ በኋላ እንደገና ይሞክሩ።',
  },
});

// General API: 500 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 500 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login',          authLimiter);
app.use('/api/auth/register',       authLimiter);
app.use('/api/auth/forgot-password',authLimiter);
app.use('/api/auth/refresh',        authLimiter); // prevent brute-force token rotation

// Audit Logger Middleware
const auditLogger = require('./middleware/auditLogger');
app.use('/api', auditLogger);

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/auth/magic-link', require('./routes/magicLink'));
app.use('/api/farms',         require('./routes/farms'));
app.use('/api/devices',       require('./routes/devices'));
app.use('/api/sensors',       require('./routes/sensors'));
app.use('/api/irrigation',    require('./routes/irrigation'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/weather',       require('./routes/weather'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/audit-logs',    require('./routes/auditLogs'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/activities',    require('./routes/activities'));
app.use('/api/attendance',    require('./routes/attendance'));
app.use('/api/payroll',       require('./routes/payroll'));
app.use('/api/admin/users',   require('./routes/adminUsers'));
app.use('/api/maintenance',   require('./routes/maintenance'));
app.use('/api/billing',       require('./routes/billing'));
app.use('/api/inventory',     require('./routes/inventory'));

// Centralized error handler (must be after routes)
app.use(require('./middleware/errorHandler'));

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Smart Irrigation API is running' });
});

// ESP8266 Heartbeat Endpoint (called every 10-15 seconds)
app.post('/api/esp8266/heartbeat', deviceAuth, async (req, res) => {
  try {
    const { deviceId, batteryLevel, signalStrength, firmwareVersion } = req.body;
    
    const Device = require('./models/Device');
    
    let device = await Device.findOne({ $or: [{ macAddress: deviceId }, { name: deviceId }] });
    if (device) {
      device.status = 'online';
      device.lastSeen = new Date();
      if (batteryLevel !== undefined) device.batteryLevel = batteryLevel;
      if (signalStrength !== undefined) device.signalStrength = signalStrength;
      if (firmwareVersion !== undefined) device.firmwareVersion = firmwareVersion;
      await device.save();
      
      // Broadcast status change via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.emit('device:status', { 
          deviceId: device._id.toString(), 
          status: 'online',
          lastSeen: device.lastSeen,
          batteryLevel: device.batteryLevel,
          signalStrength: device.signalStrength
        });
      }
      
      res.json({ status: 'ok', message: 'Heartbeat received' });
    } else {
      res.status(404).json({ error: 'Device not registered' });
    }
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Heartbeat processing failed' });
  }
});

// ESP8266 Data Ingestion Endpoint
app.post('/api/esp8266/data', deviceAuth, async (req, res) => {
  try {
    const { deviceId, sensors, pumpStatus, batteryLevel, signalStrength, firmwareVersion } = req.body;
    
    const Device = require('./models/Device');
    const SensorData = require('./models/SensorData');
    const IrrigationLog = require('./models/IrrigationLog');
    const Command = require('./models/Command');

    if (!deviceId || !Array.isArray(sensors)) {
      return res.status(400).json({ success: false, error: 'deviceId and sensors array are required' });
    }

    // Devices must be explicitly registered by an administrator. This prevents
    // untrusted hardware from creating farms or writing data into the system.
    let device = await Device.findOne({ $or: [{ macAddress: deviceId }, { name: deviceId }] });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device is not registered' });
    }
    device.status = 'online';
    device.lastSeen = new Date();
    if (batteryLevel !== undefined) device.batteryLevel = batteryLevel;
    if (signalStrength !== undefined) device.signalStrength = signalStrength;
    if (firmwareVersion !== undefined) device.firmwareVersion = firmwareVersion;
    await device.save();

    // 2. Save sensor data
    const alerts = [];
    if (sensors && Array.isArray(sensors)) {
      for (const s of sensors) {
        const dataPoint = new SensorData({
          deviceId: device._id,
          sensorType: s.type, // e.g. moisture, pH, temperature, humidity, tankLevel
          value: s.value
        });
        await dataPoint.save();

        // Alert conditions
        if (s.type === 'moisture' && s.value < 30) {
          alerts.push({ type: 'warning', message: 'Soil is dangerously dry!' });
        }
        if (s.type === 'tankLevel' && s.value === 0) {
          alerts.push({ type: 'alarm', message: 'Water tank is empty! Auto-irrigation disabled.' });
        }
      }
    }

    // 3. Log pump state transitions in DB
    if (pumpStatus) {
      const lastLog = await IrrigationLog.findOne({ deviceId: device._id }).sort({ timestamp: -1 });
      if (!lastLog || lastLog.status !== pumpStatus) {
        const newLog = new IrrigationLog({
          deviceId: device._id,
          status: pumpStatus, // 'ON' or 'OFF'
          triggeredBy: lastLog ? 'auto' : 'manual', // guess mode
          timestamp: new Date()
        });
        await newLog.save();
      }
    }

    // 4. Retrieve pending manual commands
    const pendingPumpCommand = await Command.findOne({
      deviceId: device._id,
      commandType: { $in: ['PUMP_ON', 'PUMP_OFF'] },
      status: 'sent'
    }).sort({ createdAt: -1 });

    let responsePump = pumpStatus || 'OFF';
    if (pendingPumpCommand) {
      responsePump = pendingPumpCommand.commandType === 'PUMP_ON' ? 'ON' : 'OFF';
      pendingPumpCommand.status = 'acknowledged';
      await pendingPumpCommand.save();
    }

    const pendingBuzzerCommand = await Command.findOne({
      deviceId: device._id,
      commandType: { $in: ['BUZZER_ON', 'BUZZER_OFF'] },
      status: 'sent'
    }).sort({ createdAt: -1 });

    let responseBuzzer = 'OFF';
    if (pendingBuzzerCommand) {
      responseBuzzer = pendingBuzzerCommand.commandType === 'BUZZER_ON' ? 'ON' : 'OFF';
      pendingBuzzerCommand.status = 'acknowledged';
      await pendingBuzzerCommand.save();
    }

    // 5. Broadcast to socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('sensor:update', {
        deviceId: device._id,
        sensors: sensors,
        pumpStatus: responsePump,
        buzzerStatus: responseBuzzer,
        timestamp: new Date()
      });
      alerts.forEach(alert => {
        io.emit('system:alert', alert);
      });
    }

    res.status(200).json({
      success: true,
      pump: responsePump,
      buzzer: responseBuzzer,
      alerts
    });
  } catch (error) {
    console.error('Error handling ESP8266 data:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// Database connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_irrigation')
  .then(() => {
    console.log('Connected to MongoDB');

    // Start device status monitoring service
    const { startDeviceStatusMonitor } = require('./services/deviceStatusService');
    startDeviceStatusMonitor(io, 10000); // Check every 10 seconds

    // ── Automation scheduler (node-cron) ─────────────────────────
    // Runs every 5 minutes while the server is up.
    const cron = require('node-cron');
    const { evaluateIrrigationRules } = require('./services/automationService');

    cron.schedule('*/5 * * * *', async () => {
      console.log('[Cron] Running irrigation automation check...');
      await evaluateIrrigationRules();
    });

    console.log('⏱️  Automation scheduler started (every 5 minutes)');
  })
  .catch((err) => {
    console.error('MongoDB connection error. Starting server without DB:', err.message);
  });

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔌 WebSocket ready`);
  console.log(`📡 ESP8266: POST /api/esp8266/heartbeat  |  POST /api/esp8266/data`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Run this command to free it, then restart:\n`);
    console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
    process.exit(1);
  } else {
    throw err;
  }
});
