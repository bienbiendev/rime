import { describe, expect, it } from 'vitest';
import { metasFields } from '../fields.js';
import { stampCreatedBy, stampUpdatedBy } from './stamp-authorship.server.js';

/** A member of another auth collection, such as `users`: signed in, not staff. */
const member = { id: 'u1', name: 'Ann', email: 'ann@x.io', roles: ['user'] };
const staff = { id: 's1', name: 'Bob', email: 'bob@x.io', roles: ['admin'], isStaff: true };

const run = async (hook: typeof stampCreatedBy | typeof stampUpdatedBy, user: unknown) => {
  const result = await hook({
    data: { title: 'a' },
    event: { locals: { user } },
    context: {}
  } as any);
  return (result as any).data;
};

describe('stampCreatedBy', () => {
  it('records a staff member', async () => {
    expect(await run(stampCreatedBy, staff)).toEqual({
      title: 'a',
      createdBy: 's1',
      updatedBy: 's1'
    });
  });

  it('records nothing for a member, the columns name staff', async () => {
    expect(await run(stampCreatedBy, member)).toEqual({ title: 'a' });
  });
});

describe('stampUpdatedBy', () => {
  it('records nothing for a member', async () => {
    expect(await run(stampUpdatedBy, member)).toEqual({ title: 'a' });
  });
});

describe('metasFields', () => {
  it('lets only staff set createdBy and updatedBy on a create', () => {
    for (const field of [metasFields.createdBy(), metasFields.updatedBy()]) {
      expect(field.use.accessCreate(member)).toBe(false);
      expect(field.use.accessCreate(staff)).toBe(true);
    }
  });
});
