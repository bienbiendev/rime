import { describe, expect, it } from 'vitest';
import { hasRoles, isAdmin, isAdminOrMe, isStaff } from './access.js';
import type { User } from './types.js';

const user = { id: 'u1', roles: ['user'] } as unknown as User;
const admin = { id: 'a1', roles: ['admin'] } as unknown as User;
const editor = { id: 'e1', roles: ['editor'], isStaff: true } as unknown as User;

describe('isAdminOrMe', () => {
  it('refuses an anonymous caller, with or without an id', () => {
    expect(isAdminOrMe(undefined, undefined)).toBe(false);
    expect(isAdminOrMe(undefined, 'u1')).toBe(false);
  });

  it('accepts the user themselves and an admin', () => {
    expect(isAdminOrMe(user, 'u1')).toBe(true);
    expect(isAdminOrMe(admin, 'u1')).toBe(true);
    expect(isAdminOrMe(user, 'u2')).toBe(false);
    expect(isAdminOrMe(user, undefined)).toBe(false);
  });
});

describe('isAdmin', () => {
  it('accepts the admin role only', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin({ ...editor, roles: ['editor', 'admin'] })).toBe(true);
    expect(isAdmin(editor)).toBe(false);
    expect(isAdmin(user)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe('isStaff', () => {
  it('reads the staff flag, not the roles', () => {
    expect(isStaff(editor)).toBe(true);
    // An admin role on a user that is not flagged staff
    expect(isStaff(admin)).toBe(false);
    expect(isStaff({ ...editor, isStaff: false })).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });
});

describe('hasRoles', () => {
  it('accepts a user holding any one of the roles', () => {
    expect(hasRoles(editor, 'editor', 'reviewer')).toBe(true);
    expect(hasRoles(editor, 'reviewer')).toBe(false);
    expect(hasRoles(editor)).toBe(false);
    expect(hasRoles(undefined, 'editor')).toBe(false);
  });
});
