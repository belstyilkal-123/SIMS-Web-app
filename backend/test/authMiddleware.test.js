/**
 * authMiddleware unit tests (Jest)
 * Updated for 5-role system: owner, admin, office_manager, farmer, labor
 * Middleware now checks user.assignedRole (spec §54)
 */

const { authorize, isAdministrator, isAdmin, isOwner, isLabor, isOfficeManager, isFarmer, ROLES } =
  require('../middleware/authMiddleware');

/* Helper — build mock req/res for middleware testing */
function run(middleware, assignedRole) {
  let statusCode, body, nextCalled = false;
  const user = assignedRole ? { assignedRole, accountStatus: 'active' } : null;
  const req  = { user, lang: 'en' };
  const res  = {
    status(code) { statusCode = code; return this; },
    json(value)  { body = value; },
  };
  middleware(req, res, () => { nextCalled = true; });
  return { statusCode, body, nextCalled };
}

describe('authorize() — role guard', () => {
  it('calls next() when assignedRole is in allowed list', () => {
    const { nextCalled } = run(authorize('admin', 'farmer'), 'farmer');
    expect(nextCalled).toBe(true);
  });

  it('returns 403 when assignedRole is not in allowed list', () => {
    const { statusCode, nextCalled } = run(authorize('admin'), 'farmer');
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });

  it('returns 403 when labor tries to access admin route', () => {
    const { statusCode } = run(authorize('admin', 'farmer'), 'labor');
    expect(statusCode).toBe(403);
  });

  it('returns 403 when office_manager tries to access admin-only route', () => {
    const { statusCode } = run(authorize('admin'), 'office_manager');
    expect(statusCode).toBe(403);
  });

  it('permits office_manager when included in allowed list', () => {
    const { nextCalled } = run(authorize('admin', 'office_manager'), 'office_manager');
    expect(nextCalled).toBe(true);
  });

  it('permits owner when included in allowed list', () => {
    const { nextCalled } = run(authorize('owner', 'admin'), 'owner');
    expect(nextCalled).toBe(true);
  });

  it('returns 403 when user is null/undefined', () => {
    const { statusCode } = run(authorize('admin'), null);
    expect(statusCode).toBe(403);
  });
});

describe('Role helper functions', () => {
  it('isAdmin returns true for admin assignedRole', () => {
    expect(isAdmin({ assignedRole: 'admin' })).toBe(true);
  });

  it('isAdmin returns false for farmer', () => {
    expect(isAdmin({ assignedRole: 'farmer' })).toBe(false);
  });

  it('isAdministrator is an alias for isAdmin', () => {
    expect(isAdministrator).toBe(isAdmin);
  });

  it('isOwner returns true for owner assignedRole', () => {
    expect(isOwner({ assignedRole: 'owner' })).toBe(true);
  });

  it('isOwner returns false for admin', () => {
    expect(isOwner({ assignedRole: 'admin' })).toBe(false);
  });

  it('isLabor returns true for labor assignedRole', () => {
    expect(isLabor({ assignedRole: 'labor' })).toBe(true);
  });

  it('isLabor returns false for farmer', () => {
    expect(isLabor({ assignedRole: 'farmer' })).toBe(false);
  });

  it('isOfficeManager returns true for office_manager', () => {
    expect(isOfficeManager({ assignedRole: 'office_manager' })).toBe(true);
  });

  it('isOfficeManager returns false for admin', () => {
    expect(isOfficeManager({ assignedRole: 'admin' })).toBe(false);
  });

  it('isFarmer returns true for farmer', () => {
    expect(isFarmer({ assignedRole: 'farmer' })).toBe(true);
  });

  it('ROLES constant contains all 5 roles', () => {
    expect(ROLES).toMatchObject({
      OWNER:          'owner',
      ADMIN:          'admin',
      OFFICE_MANAGER: 'office_manager',
      FARMER:         'farmer',
      LABOR:          'labor',
    });
  });
});
