/**
 * Automation service unit tests (Jest)
 * Tests: DB query logic, pump ON/OFF rules, NPK debounce, null-sensor skip, weather skip
 */

process.env.JWT_SECRET = 'test_secret_key_for_jest';

// ── Shared state collectors ───────────────────────────────────────────────────
const mockCommands  = [];
const mockNotifs    = [];
const mockSensorMap = {}; // `${deviceId}_${sensorType}` → value | null

// ── Mock models at top level ──────────────────────────────────────────────────
jest.mock('../models/Device', () => ({
  find: jest.fn(),
}));
jest.mock('../models/SensorData', () => ({
  findOne: jest.fn(),
}));
jest.mock('../models/Command', () => ({
  findOne: jest.fn(),
  create:  jest.fn(),
}));

jest.mock('../models/Notification', () => ({
  findOne: jest.fn(),
  create:  jest.fn(),
}));

jest.mock('mongoose', () => {
  const farmMock = {
    select:   jest.fn(),
    lean:     jest.fn().mockResolvedValue(null),
    populate: jest.fn(),
  };
  // Make each chained method return the same object so any chain terminates cleanly
  farmMock.select.mockReturnValue(farmMock);
  farmMock.populate.mockReturnValue(farmMock);

  return {
    model: jest.fn().mockReturnValue({
      findById: jest.fn().mockReturnValue(farmMock),
    }),
  };
});

jest.mock('../services/weatherService', () => ({
  getForecast: jest.fn(),
}));

jest.mock('../services/notificationService', () => ({
  sendSMS:   jest.fn().mockResolvedValue(),
  sendEmail: jest.fn().mockResolvedValue(),
}));

// ── Pull the mocks after jest.mock calls ─────────────────────────────────────
const Device       = require('../models/Device');
const SensorData   = require('../models/SensorData');
const Command      = require('../models/Command');
const Notification = require('../models/Notification');
const weatherSvc   = require('../services/weatherService');

// ── The system under test ────────────────────────────────────────────────────
const { evaluateIrrigationRules } = require('../services/automationService');

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeDevice = (id, farmId = 'farm1') => ({ _id: id, farmId, status: 'online' });

beforeEach(() => {
  mockCommands.length = 0;
  mockNotifs.length   = 0;
  Object.keys(mockSensorMap).forEach(k => delete mockSensorMap[k]);

  Device.find.mockImplementation(() => ({ lean: () => Promise.resolve([]) }));
  SensorData.findOne.mockImplementation(({ deviceId, sensorType } = {}) => {
    const val = mockSensorMap[`${deviceId}_${sensorType}`];
    const result = val != null ? { value: val } : null;
    return { lean: () => Promise.resolve(result) };
  });
  Command.findOne.mockResolvedValue(null);
  Command.create.mockImplementation(data => { mockCommands.push({ ...data }); return Promise.resolve(data); });
  Notification.findOne.mockImplementation(() => ({ lean: () => Promise.resolve(null) }));
  Notification.create.mockImplementation(data => { mockNotifs.push({ ...data }); return Promise.resolve(data); });
  weatherSvc.getForecast.mockResolvedValue({ recommendPostpone: false });
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('evaluateIrrigationRules — no devices', () => {
  it('exits silently when device list is empty', async () => {
    await evaluateIrrigationRules();
    expect(Command.create).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });
});

describe('evaluateIrrigationRules — null sensor data', () => {
  it('skips device when moisture is null', async () => {
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev1')]) }));
    mockSensorMap['dev1_tankLevel'] = 60; // only tank set, moisture missing

    await evaluateIrrigationRules();
    expect(Command.create).not.toHaveBeenCalled();
  });

  it('skips device when tankLevel is null', async () => {
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev2')]) }));
    mockSensorMap['dev2_moisture'] = 20; // only moisture set

    await evaluateIrrigationRules();
    expect(Command.create).not.toHaveBeenCalled();
  });
});

describe('evaluateIrrigationRules — Pump ON rule', () => {
  it('issues PUMP_ON when moisture < 30 and tank > 20', async () => {
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev_on')]) }));
    mockSensorMap['dev_on_moisture']  = 25;
    mockSensorMap['dev_on_tankLevel'] = 60;

    await evaluateIrrigationRules();

    const cmd = mockCommands.find(c => c.commandType === 'PUMP_ON');
    expect(cmd).toBeDefined();
    expect(cmd.deviceId).toBe('dev_on');
  });

  it('creates a notification when pump is auto-started', async () => {
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev_notif')]) }));
    mockSensorMap['dev_notif_moisture']  = 20;
    mockSensorMap['dev_notif_tankLevel'] = 50;

    await evaluateIrrigationRules();

    const notif = mockNotifs.find(n => n.message && /irrigation started/i.test(n.message));
    expect(notif).toBeDefined();
  });

  it('does NOT duplicate PUMP_ON if command already pending', async () => {
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev_dup')]) }));
    Command.findOne.mockResolvedValueOnce({ commandType: 'PUMP_ON', status: 'sent' });
    mockSensorMap['dev_dup_moisture']  = 20;
    mockSensorMap['dev_dup_tankLevel'] = 50;

    await evaluateIrrigationRules();
    expect(mockCommands.filter(c => c.commandType === 'PUMP_ON').length).toBe(0);
  });

  it('does NOT issue PUMP_ON when tank level <= 20', async () => {
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev_low_tank')]) }));
    mockSensorMap['dev_low_tank_moisture']  = 20;
    mockSensorMap['dev_low_tank_tankLevel'] = 15;

    await evaluateIrrigationRules();
    expect(mockCommands.find(c => c.commandType === 'PUMP_ON')).toBeUndefined();
  });
});

describe('evaluateIrrigationRules — Pump OFF rule', () => {
  it('issues PUMP_OFF when moisture >= 70', async () => {
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev_moist')]) }));
    mockSensorMap['dev_moist_moisture']  = 75;
    mockSensorMap['dev_moist_tankLevel'] = 60;

    await evaluateIrrigationRules();
    const cmd = mockCommands.find(c => c.commandType === 'PUMP_OFF');
    expect(cmd).toBeDefined();
  });

  it('issues PUMP_OFF when tank < 5', async () => {
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev_tank')]) }));
    mockSensorMap['dev_tank_moisture']  = 40;
    mockSensorMap['dev_tank_tankLevel'] = 3;

    await evaluateIrrigationRules();
    const cmd = mockCommands.find(c => c.commandType === 'PUMP_OFF');
    expect(cmd).toBeDefined();
  });

  it('creates critical alarm notification when tank < 5', async () => {
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev_alarm')]) }));
    mockSensorMap['dev_alarm_moisture']  = 40;
    mockSensorMap['dev_alarm_tankLevel'] = 2;

    await evaluateIrrigationRules();
    const notif = mockNotifs.find(n => n.type === 'alarm');
    expect(notif).toBeDefined();
    expect(notif.message).toMatch(/tank/i);
  });
});

describe('evaluateIrrigationRules — weather skip', () => {
  it('skips PUMP_ON when rain is forecast', async () => {
    weatherSvc.getForecast.mockResolvedValueOnce({ recommendPostpone: true });
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev_rain')]) }));
    mockSensorMap['dev_rain_moisture']  = 20;
    mockSensorMap['dev_rain_tankLevel'] = 50;

    await evaluateIrrigationRules();
    expect(mockCommands.find(c => c.commandType === 'PUMP_ON')).toBeUndefined();
  });

  it('still issues PUMP_OFF for saturated soil even when rain forecast', async () => {
    weatherSvc.getForecast.mockResolvedValueOnce({ recommendPostpone: true });
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev_sat')]) }));
    mockSensorMap['dev_sat_moisture']  = 80; // >= 70, triggers PUMP_OFF
    mockSensorMap['dev_sat_tankLevel'] = 50;

    await evaluateIrrigationRules();
    const cmd = mockCommands.find(c => c.commandType === 'PUMP_OFF');
    expect(cmd).toBeDefined();
  });
});

describe('evaluateIrrigationRules — NPK recommendations', () => {
  it('creates NPK notification when nitrogen is low', async () => {
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev_npk')]) }));
    mockSensorMap['dev_npk_moisture']    = 55;
    mockSensorMap['dev_npk_tankLevel']   = 60;
    mockSensorMap['dev_npk_nitrogen']    = 30; // < 50 → low
    mockSensorMap['dev_npk_phosphorus']  = 45;
    mockSensorMap['dev_npk_potassium']   = 65;

    await evaluateIrrigationRules();
    const notif = mockNotifs.find(n => n.message && /Fertilizer|NPK/i.test(n.message));
    expect(notif).toBeDefined();
    expect(notif.type).toBe('info');
  });

  it('does NOT create duplicate NPK notification within 24h (debounce)', async () => {
    Notification.findOne.mockImplementationOnce(() => ({ lean: () => Promise.resolve({ message: 'NPK levels are low (recent)' }) }));
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev_npk2')]) }));
    mockSensorMap['dev_npk2_moisture']    = 55;
    mockSensorMap['dev_npk2_tankLevel']   = 60;
    mockSensorMap['dev_npk2_nitrogen']    = 10;
    mockSensorMap['dev_npk2_phosphorus']  = 10;
    mockSensorMap['dev_npk2_potassium']   = 10;

    await evaluateIrrigationRules();
    const npkNotifs = mockNotifs.filter(n => n.message && /Fertilizer|NPK/i.test(n.message));
    expect(npkNotifs.length).toBe(0);
  });

  it('skips NPK check when nitrogen data is null', async () => {
    Device.find.mockImplementationOnce(() => ({ lean: () => Promise.resolve([makeDevice('dev_nonpk')]) }));
    mockSensorMap['dev_nonpk_moisture']  = 55;
    mockSensorMap['dev_nonpk_tankLevel'] = 60;
    // nitrogen/phosphorus/potassium not set

    await evaluateIrrigationRules();
    expect(mockNotifs.find(n => n.message && /NPK/i.test(n.message))).toBeUndefined();
  });
});
