import type { Adapter } from '$lib/core/adapter.js';
import type { CollectionSlug } from '$lib/core/prototype/types.js';
import { STAFF_SLUG } from './tables.js';
import type { User } from './types.js';

/**
 * The three reads auth needs about its own rows.
 *
 * They were `adapter.auth.isSuperAdmin`, `.getBetterAuthUserId` and `.getUserAttributes` — a third
 * of a facade on the `Adapter` interface, for one feature. Each is
 * `select … from <a prototype's table> where <a column> = ?`, which is what `findMany` already is;
 * what made them look like adapter work was that all three named a collection called `staff` and
 * the database layer was the only place that name appeared.
 *
 * It appears here instead, once, as `STAFF_SLUG` — and it belongs here because this feature is
 * what derives that collection (`staff/configure.ts`).
 *
 * > **These read rows, not documents.** `adapter.collection(slug).findMany` runs no hooks and no
 * > access checks, which is deliberate and load-bearing: all three run *during* authentication,
 * > before there is a user to check anything against. Going through `rime.collection(slug).find()`
 * > would recurse — the access check needs the user this call is resolving.
 */

/**
 * Whether this staff member is the super-admin.
 *
 * A wrong answer here is a privilege escalation rather than a bug, so it asks for the row and the
 * flag together: no row matching *both* means no.
 */
export const isSuperAdmin = async (adapter: Adapter, userId: string): Promise<boolean> => {
  const [found] = await adapter.collection(STAFF_SLUG).findMany({
    query: {
      where: { and: [{ id: { equals: userId } }, { isSuperAdmin: { equals: true } }] }
    },
    select: ['id'],
    limit: 1
  });

  return !!found;
};

/** The better-auth user a collection row is linked to, or `null` when it is linked to none. */
export const betterAuthUserId = async (
  adapter: Adapter,
  args: { slug: CollectionSlug; id: string }
): Promise<string | null> => {
  const [row] = await adapter.collection(args.slug).findMany({
    query: { where: { id: { equals: args.id } } },
    select: ['authUserId'],
    limit: 1
  });

  return (row?.authUserId as string | undefined) ?? null;
};

/**
 * The session user, read off the collection row a better-auth user is linked to.
 *
 * The members are named rather than spread, which is what the hand-written `db.select()` did too:
 * this object becomes `event.locals.user` and reaches the client through `toPublicUser`, so what
 * it carries is a decision, not whatever the read happened to return.
 */
export const userAttributes = async (
  adapter: Adapter,
  args: { authUserId: string; slug: CollectionSlug }
): Promise<User | undefined> => {
  const isStaff = args.slug === STAFF_SLUG;

  const [row] = await adapter.collection(args.slug).findMany({
    query: { where: { authUserId: { equals: args.authUserId } } },
    // `isSuperAdmin` is only a column on the collection this feature derives. A `select` naming a
    // column the table does not have is dropped, so asking for it everywhere would also work —
    // but then nothing would say that only one collection has it.
    select: isStaff
      ? ['id', 'name', 'email', 'roles', 'isSuperAdmin']
      : ['id', 'name', 'email', 'roles'],
    limit: 1
  });

  if (!row) return undefined;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roles: row.roles,
    ...(isStaff ? { isSuperAdmin: row.isSuperAdmin === true } : {}),
    isStaff
  } as User;
};
