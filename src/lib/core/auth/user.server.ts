import type { Adapter } from '#lib/core/adapter.js';
import type { CollectionSlug } from '#lib/core/prototype/types.js';
import { STAFF_SLUG } from './constant.js';
import type { User } from './types.js';

/**
 * The reads auth needs about its own rows.
 *
 * > **These read rows, not documents.** `adapter.collection(slug).findMany` runs no hooks and no
 * > access checks. Most of them run *during* authentication, before there is a user to check
 * > anything against: going through `rime.collection(slug).find()` would recurse, since the access
 * > check needs the user this call is resolving. The others read the private fields a document
 * > never carries.
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

/** The better-auth api key a collection row holds and the user that created it, or `null`. */
export const betterAuthApiKey = async (
  adapter: Adapter,
  args: { slug: CollectionSlug; id: string }
): Promise<{ keyId: string; userId: string } | null> => {
  const [row] = await adapter.collection(args.slug).findMany({
    query: { where: { id: { equals: args.id } } },
    select: ['apiKeyId', 'authUserId'],
    limit: 1
  });

  if (!row?.apiKeyId) {
    return null;
  }
  return { keyId: row.apiKeyId as string, userId: row.authUserId as string };
};

/**
 * The session user, read off the collection row a better-auth user is linked to.
 *
 * The members are named rather than spread: this object becomes `event.locals.user` and reaches
 * the client through `toPublicUser`.
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

/**
 * The session user of a request made with an api key: the key's own document, with the roles the
 * key carries. Not staff, so the panel stays closed to it. `slugs` are the api-key collections,
 * asked in turn.
 */
export const apiKeyUser = async (
  adapter: Adapter,
  args: { slugs: CollectionSlug[]; apiKeyId: string; roles: string[] }
): Promise<User | undefined> => {
  for (const slug of args.slugs) {
    const [row] = await adapter.collection(slug).findMany({
      query: { where: { apiKeyId: { equals: args.apiKeyId } } },
      select: ['id', 'name'],
      limit: 1
    });
    if (row) {
      return { id: row.id, name: row.name, email: '', roles: args.roles, isStaff: false } as User;
    }
  }
  return undefined;
};
