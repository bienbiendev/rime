import { describe, expect, it } from 'vitest';
import type { Adapter } from '$lib/core/adapter.js';
import { deleteAuthUser, hasAuthUser, setAuthUserRole } from './better-auth-tables.server.js';

/**
 * What these ask of Better-auth's tables, pinned.
 *
 * `deleteAuthUser` is the one that matters: it undoes a half-made signup, and it deletes sessions
 * before the user it belongs to. Reversed, the row is gone but the session that authenticates as
 * it is not — and nothing here relies on a database cascade to catch that. The order is the
 * property, so the order is what is asserted.
 */

type Call = { slug: string; verb: 'find' | 'update' | 'delete'; args: any };

const stubAdapter = (rows: any[] = []) => {
  const calls: Call[] = [];
  const adapter = {
    table: (slug: string) => ({
      find: async (args: any) => (calls.push({ slug, verb: 'find', args }), rows),
      update: async (args: any) => void calls.push({ slug, verb: 'update', args }),
      delete: async (args: any) => void calls.push({ slug, verb: 'delete', args })
    })
  } as unknown as Adapter;
  return { adapter, calls };
};

describe('hasAuthUser', () => {
  it('asks for one id rather than a row', async () => {
    const { adapter, calls } = stubAdapter([{ id: 'au1' }]);

    expect(await hasAuthUser(adapter)).toBe(true);
    expect(calls[0]).toMatchObject({
      slug: '$authUsers',
      verb: 'find',
      args: { select: ['id'], limit: 1 }
    });
  });

  it('is false before anybody has signed up', async () => {
    const { adapter } = stubAdapter([]);
    expect(await hasAuthUser(adapter)).toBe(false);
  });
});

describe('setAuthUserRole', () => {
  it("writes Better-auth's own role column, on that user alone", async () => {
    const { adapter, calls } = stubAdapter();

    await setAuthUserRole(adapter, { authUserId: 'au1', role: 'admin' });

    expect(calls).toEqual([
      {
        slug: '$authUsers',
        verb: 'update',
        args: { where: { id: 'au1' }, data: { role: 'admin' } }
      }
    ]);
  });
});

describe('deleteAuthUser', () => {
  it('deletes sessions and accounts before the user they reference', async () => {
    const { adapter, calls } = stubAdapter();

    await deleteAuthUser(adapter, { authUserId: 'au1' });

    expect(calls.map((call) => call.slug)).toEqual([
      '$authSessions',
      '$authAccounts',
      '$authUsers'
    ]);
    expect(calls.every((call) => call.verb === 'delete')).toBe(true);
    expect(calls[0].args).toEqual({ where: { userId: 'au1' } });
    expect(calls[1].args).toEqual({ where: { userId: 'au1' } });
    expect(calls[2].args).toEqual({ where: { id: 'au1' } });
  });
});
