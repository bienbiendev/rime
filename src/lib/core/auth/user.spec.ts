import { describe, expect, it } from 'vitest';
import type { Adapter } from '$lib/core/adapter.js';
import type { CollectionSlug } from '$lib/core/prototype/types.js';
import { betterAuthUserId, isSuperAdmin, userAttributes } from './user.server.js';

/**
 * What these three reads ask for, pinned.
 *
 * They moved off the `Adapter` interface, where they were hand-written SQL, onto
 * `collection(slug).findMany`. The queries are the whole of what changed, and two of the three are
 * access decisions: a wrong `isSuperAdmin` is a privilege escalation, and it fails *open* — the
 * caller only ever asks "is this the super-admin?", so a query that matches nothing reads as "no"
 * and a query that matches too much reads as "yes". Neither is visible in a passing suite.
 *
 * So this asserts the call, not the result. The rows come from a stub; what is under test is the
 * slug, the filter and the projection.
 */

type Call = { slug: string; args: any };

const stubAdapter = (rows: any[]) => {
  const calls: Call[] = [];
  const adapter = {
    collection: (slug: string) => ({
      findMany: async (args: any) => {
        calls.push({ slug, args });
        return rows;
      }
    })
  } as unknown as Adapter;
  return { adapter, calls };
};

describe('isSuperAdmin', () => {
  it('asks the staff collection for a row that is both this id and flagged', async () => {
    const { adapter, calls } = stubAdapter([{ id: 'u1' }]);

    expect(await isSuperAdmin(adapter, 'u1')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].slug).toBe('staff');
    expect(calls[0].args.query.where).toEqual({
      and: [{ id: { equals: 'u1' } }, { isSuperAdmin: { equals: true } }]
    });
  });

  it('is false when nothing matches both', async () => {
    const { adapter } = stubAdapter([]);
    expect(await isSuperAdmin(adapter, 'u1')).toBe(false);
  });
});

describe('betterAuthUserId', () => {
  it('reads the link off the row, and answers null when there is none', async () => {
    const { adapter, calls } = stubAdapter([{ id: 'u1', authUserId: 'au1' }]);

    expect(await betterAuthUserId(adapter, { slug: 'users' as CollectionSlug, id: 'u1' })).toBe(
      'au1'
    );
    expect(calls[0].slug).toBe('users');
    expect(calls[0].args.query.where).toEqual({ id: { equals: 'u1' } });
    expect(calls[0].args.select).toEqual(['authUserId']);

    const empty = stubAdapter([]);
    expect(
      await betterAuthUserId(empty.adapter, { slug: 'users' as CollectionSlug, id: 'u1' })
    ).toBeNull();
  });
});

describe('userAttributes', () => {
  it('asks for the super-admin flag on staff, and marks the user as staff', async () => {
    const { adapter, calls } = stubAdapter([
      { id: 'u1', name: 'A', email: 'a@b.c', roles: ['admin'], isSuperAdmin: true }
    ]);

    const user = await userAttributes(adapter, {
      authUserId: 'au1',
      slug: 'staff' as CollectionSlug
    });

    expect(calls[0].args.query.where).toEqual({ authUserId: { equals: 'au1' } });
    expect(calls[0].args.select).toEqual(['id', 'name', 'email', 'roles', 'isSuperAdmin']);
    expect(user).toEqual({
      id: 'u1',
      name: 'A',
      email: 'a@b.c',
      roles: ['admin'],
      isSuperAdmin: true,
      isStaff: true
    });
  });

  it('does not ask any other collection for a flag it has no column for', async () => {
    const { adapter, calls } = stubAdapter([
      { id: 'u1', name: 'A', email: 'a@b.c', roles: ['user'] }
    ]);

    const user = await userAttributes(adapter, {
      authUserId: 'au1',
      slug: 'users' as CollectionSlug
    });

    expect(calls[0].args.select).toEqual(['id', 'name', 'email', 'roles']);
    expect(user).toEqual({ id: 'u1', name: 'A', email: 'a@b.c', roles: ['user'], isStaff: false });
  });

  it('carries nothing the read happened to return beyond the members it names', async () => {
    const { adapter } = stubAdapter([
      { id: 'u1', name: 'A', email: 'a@b.c', roles: [], contentId: 'leak', password: 'leak' }
    ]);

    const user = await userAttributes(adapter, {
      authUserId: 'au1',
      slug: 'users' as CollectionSlug
    });

    expect(Object.keys(user!).sort()).toEqual(['email', 'id', 'isStaff', 'name', 'roles']);
  });

  it('is undefined when no row is linked to that auth user', async () => {
    const { adapter } = stubAdapter([]);
    expect(
      await userAttributes(adapter, { authUserId: 'au1', slug: 'users' as CollectionSlug })
    ).toBeUndefined();
  });
});
