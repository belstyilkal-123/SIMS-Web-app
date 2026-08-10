/**
 * authMiddleware unit tests (Jest)
 * Covers: authorize() role guard, isAdministrator/isLabor/isOfficeManager helpers
 */

const { authorize, isAdministrator, isAdmin, isLabor, isOfficeManager, ROLES } = require('../middleware/authMiddleware');

function run(middleware, user) {
  let statusCode;
  let body;
  let nextCalled = false;
  const req = { user, lang: 'en' };
  const res = {
    status(code) { statusCode = code; return this; },
    json(value)  { body = value; }
  };
  middleware(req, res, () => { nextCalled = true; });
  return { statusCode, body, nextCalled };
}

describe('authorize()', () => {
  it('calls next() when role is in allowed list', () => {
    const { nextCalled } = run(authorize('super_administrator', 'farmer'), { role: 'farmer' });
    expect(nextCalled).toBe(true);
  });

  it('returns 403 when role is not in allowed list', () => {
    const { statusCode, nextCalled } = run(authorize('super_administrator'), { role: 'farmer' });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });

  it('returns 403 when labor tries to access admin route', () => {
    const { statusCode } = run(authorize('super_administrator', 'farmer'), { role: 'labor' });
    expect(statusCode).toBe(403);
  });

  it('returns 403 when office_manager tries to access admin-only route', () => {
    const { statusCode } = run(authorize('super_administrator'), { role: 'office_manager' });
    expect(statusCode).toBe(403);
  });

  it('permits office_manager when role is included', () => {
    const { nextCalled } = run(authorize('super_administrator', 'office_manager'), { role: 'office_manager' });
    expect(nextCalled).toBe(true);
  });

  it('returns 403 when user is null/undefined', () => {
    const { statusCode } = run(authorize('super_administrator'), null);
    expect(statusCode).toBe(403);
  });
});

describe('Role helper functions', () => {
  it('isAdministrator returns true for super_administrator role', () => {
    expect(isAdministrator({ role: 'super_administrator' })).toBe(true);
  });

  it('isAdministrator returns false for farmer role', () => {
    expect(isAdministrator({ role: 'farmer' })).toBe(false);
  });

  it('isAdmin is an alias for isAdministrator', () => {
    expect(isAdmin).toBe(isAdministrator);
  });

  it('isLabor returns true for labor role', () => {
    expect(isLabor({ role: 'labor' })).toBe(true);
  });

  it('isLabor returns false for farmer role', () => {
    expect(isLabor({ role: 'farmer' })).toBe(false);
  });

  it('isOfficeManager returns true for office_manager role', () => {
    expect(isOfficeManager({ role: 'office_manager' })).toBe(true);
  });

  it('isOfficeManager returns false for administrator', () => {
    expect(isOfficeManager({ role: 'super_administrator' })).toBe(false);
  });

  it('ROLES constant contains all four roles', () => {
    expect(ROLES).toMatchObject({
      SUPER_ADMIN:    'super_administrator',
      FARMER:         'farmer',
      LABOR:          'labor',
      OFFICE_MANAGER: 'office_manager',
    });
  });
});

