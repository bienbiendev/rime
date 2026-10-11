import { describe, expect, test } from 'vitest';
import type { User } from '../types.js';
import { getStaffCollection } from './derive.js';

const rolesOf = (built: ReturnType<typeof getStaffCollection>) =>
  (built.auth as { roles: unknown[] }).roles;

const admin = { id: 'a1', roles: ['admin'], isStaff: true } as unknown as User;
const editor = { id: 'e1', roles: ['editor'], isStaff: true } as unknown as User;

describe('getStaffCollection', () => {
  test('with no roles, has an admin and a staff role', () => {
    expect(rolesOf(getStaffCollection())).toEqual([{ value: 'admin' }, { value: 'staff' }]);
  });

  test('adds the admin role before authored roles, and no staff role', () => {
    expect(rolesOf(getStaffCollection({ roles: ['editor'] }))).toEqual([
      { value: 'admin' },
      { value: 'editor' }
    ]);
  });

  test('keeps an authored role label and adds the staff role', () => {
    expect(
      rolesOf(getStaffCollection({ roles: [{ value: 'admin', label: 'Administrator' }] }))
    ).toEqual([{ value: 'admin', label: 'Administrator' }, { value: 'staff' }]);
  });

  test('lets an admin, or a staff member on their own document, update', () => {
    const update = getStaffCollection().access!.update!;
    expect(update(admin, { id: 'e1' })).toBe(true);
    expect(update(editor, { id: 'e1' })).toBe(true);
    expect(update(editor, { id: 'a1' })).toBe(false);
    // Not staff: never "me", whatever id it sends
    expect(update({ ...editor, isStaff: false }, { id: 'e1' })).toBe(false);
  });

  test('replaces the access rules it is given and keeps the others', () => {
    const read = () => true;
    const { access } = getStaffCollection({ access: { read } });
    expect(access!.read).toBe(read);
    expect(access!.create!(admin, {})).toBe(true);
    expect(access!.create!(editor, {})).toBe(false);
  });

  test('shares nothing between two calls', () => {
    const first = getStaffCollection({ roles: ['editor'], fields: [{} as never] });
    const second = getStaffCollection();
    expect(second.fields).toEqual([]);
    expect(rolesOf(second)).toEqual([{ value: 'admin' }, { value: 'staff' }]);
    expect(first.fields).toHaveLength(1);
  });
});
