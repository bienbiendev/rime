# Annex — the auth facade

> Stage 4.3 of `docs/decoupling.md`. **Landed** — `74619ab2` and `df71014f`. What follows is the
> reasoning that produced the split; §5 records what shipped, and answers the question §2.2 left
> open.

`auth` was 98 of the adapter's ~100 remaining feature hits. 44 of them were `auth.server.ts`, a
whole facade on the `Adapter` interface for one feature.

---

## 1. What the facade does

```ts
// core/adapter.ts
export interface AuthAdapter {
  /** The Better-auth database adapter. Opaque to core, which only hands it to Better-auth. */
  betterAuthAdapter: unknown;
  hasAuthUser(): Promise<boolean>;
  getBetterAuthUserId(args: { slug: CollectionSlug; id: string }): Promise<string | null>;
  getUserAttributes(args: { authUserId: string; slug: CollectionSlug }): Promise<User | undefined>;
  isSuperAdmin(userId: string): Promise<boolean>;
  setAuthUserRole(args: { authUserId: string; role: string }): Promise<void>;
  deleteAuthUser(args: { authUserId: string }): Promise<void>;
}
```

Six methods and an opaque handle. Sort them by what they actually need.

### 1.1 The one that has to stay

```ts
const betterAuthAdapter = drizzleAdapter(db, {
  provider: 'sqlite',
  schema: {
    user: schema.authUsers,
    session: schema.authSessions,
    account: schema.authAccounts,
    verification: schema.authVerifications
  }
});
```

This is better-auth's own adapter, built from drizzle tables. It cannot be expressed in core's
vocabulary and should not be — core hands it to better-auth and never looks inside. It stays on
the interface, alone.

### 1.2 The three that are ordinary reads and writes

```ts
const isSuperAdmin = async (userId: string) => {
  const usersTable = getTable('staff'); // ← hardcoded slug
  const [user] = await db
    .select({ isSuperAdmin: usersTable.isSuperAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.isSuperAdmin === true;
};

const getBetterAuthUserId = async ({ slug, id }) => {
  const userTable = getTable(baseTableName(slug));
  const user = await db.query[baseTableName(slug)].findFirst({ where: eq(userTable.id, id) });
  return user ? user.authUserId : null;
};

const getUserAttributes = async ({ authUserId, slug }) => {
  const table = getTable(baseTableName(slug));
  const columns: Dic = { id: table.id, name: table.name, roles: table.roles, email: table.email };
  if (slug === 'staff') columns.isSuperAdmin = table.isSuperAdmin; // ← hardcoded slug
  const [user] = await db.select(columns).from(table).where(eq(table.authUserId, authUserId));
  return user ? ({ ...user, isStaff: slug === 'staff' } as User) : undefined; // ← hardcoded slug
};
```

All three are `select … from <a prototype's table> where <a column> = ?`. Every one of them is a
`findMany` the feature could issue itself. And all three carry the same tell: **the database layer
knows a collection called `staff` exists and that it is special.**

### 1.3 The three that need auth's own tables

```ts
const hasAuthUser = async () => !!(await db.query.authUsers.findFirst());
const setAuthUserRole = async ({ authUserId, role }) =>
  db
    .update(getTable('authUsers'))
    .set({ role })
    .where(eq(getTable('authUsers').id, authUserId));
const deleteAuthUser = async ({ authUserId }) => {
  await db.delete(getTable('authSessions')).where(eq(getTable('authSessions').userId, authUserId));
  await db.delete(getTable('authAccounts')).where(eq(getTable('authAccounts').userId, authUserId));
  await db.delete(getTable('authUsers')).where(eq(getTable('authUsers').id, authUserId));
};
```

These read and write `auth_users`, `auth_sessions`, `auth_accounts` — tables that exist only
because `templateAuth` emits them, and which core therefore cannot name. **That is what stage 4.2
fixes**: once `$authUsers` is a declared table with a slug, it is addressable like anything else.

---

## 2. What each becomes

### 2.1 The two hardcoded-slug ones

The staff collection is derived _by this feature_ (`features/auth/staff/derive.ts`), so the feature
is the thing that knows which slug it is:

```ts
// core/features/auth/staff/derive.ts already owns this name
export const STAFF_SLUG = 'staff' as CollectionSlug;
```

```ts
// core/features/auth/user.server.ts — was adapter.auth.isSuperAdmin(userId)
export const isSuperAdmin = async (rime: RimeContext, userId: string) => {
  const [found] = await rime.adapter.prototype(STAFF_SLUG).findMany({
    query: { where: { and: [{ id: { equals: userId } }, { isSuperAdmin: { equals: true } }] } },
    select: ['id']
  });
  return !!found;
};
```

```ts
// core/features/auth/user.server.ts — was adapter.auth.getUserAttributes({ authUserId, slug })
export const userAttributes = async (
  rime: RimeContext,
  { authUserId, slug }: { authUserId: string; slug: CollectionSlug }
): Promise<User | undefined> => {
  const isStaff = slug === STAFF_SLUG;

  const [doc] = await rime.adapter.prototype(slug).findMany({
    query: { where: { authUserId: { equals: authUserId } } },
    select: isStaff
      ? ['id', 'name', 'email', 'roles', 'isSuperAdmin']
      : ['id', 'name', 'email', 'roles'],
    limit: 1
  });

  return doc ? ({ ...doc, isStaff } as User) : undefined;
};
```

```ts
// was adapter.auth.getBetterAuthUserId({ slug, id })
const [doc] = await rime.adapter.prototype(slug).findMany({
  query: { where: { id: { equals: id } } },
  select: ['authUserId']
});
return doc?.authUserId ?? null;
```

> **`findMany` with `select` returns raw rows, not documents** — no hooks, no access checks. That
> is right here (these run _during_ authentication, before a user exists to check against) but it
> must be deliberate, and the comment should say so. Going through `rime.collection(slug).find()`
> instead would recurse: the access check needs the user this call is resolving.

### 2.2 The three on auth's own tables

Once `$authUsers`, `$authSessions` and `$authAccounts` are declared tables, they are addressable —
but they are **not prototypes**: no fields, no pipeline, no access. `adapter.prototype()` is the
wrong handle.

Two options, and the second is better:

**(a) A table handle.** `adapter.table('$authUsers')` with `find`/`insert`/`update`/`delete`
against declared tables. Honest, but a second read/write surface to maintain.

**(b) Let better-auth own them.** Everything in §1.3 is something better-auth's own API can do:

```ts
// hasAuthUser — better-auth's admin API lists users
const { users } = await auth.api.listUsers({ query: { limit: 1 } });
return users.length > 0;

// setAuthUserRole — better-auth's admin plugin owns the role column
await auth.api.setRole({ body: { userId: authUserId, role } });

// deleteAuthUser — better-auth cascades sessions and accounts itself
await auth.api.removeUser({ body: { userId: authUserId } });
```

The three raw statements exist because they were written before the better-auth instance was
reachable from where they are called. **Check that first.** If better-auth's API covers all three,
`AuthAdapter` collapses to one member and no new handle is needed:

```ts
export interface AuthAdapter {
  /** The Better-auth database adapter. Opaque to core, which only hands it to Better-auth. */
  betterAuthAdapter: unknown;
}
```

The `deleteAuthUser` comment says it deletes sessions first "so it must not leave a session behind
that would still authenticate" — verify better-auth's `removeUser` does the same before swapping,
because that one is a security property, not a tidiness one.

---

## 3. Order

```
1. Land 4.2 (FeatureDefinition.tables) — §1.3 cannot move before it.
2. Move the three ordinary reads (§2.1). Independent of everything, ~3 commits.
   The two hardcoded `'staff'` slugs go here.
3. Establish whether better-auth's API covers §1.3. Two hours of reading, and it decides
   whether §2.2 is option (a) or (b).
4. Collapse `AuthAdapter`.
```

Step 2 is worth doing on its own even if step 3 stalls: it removes `slug === 'staff'` from the
database layer, which is the single worst line in the audit.

---

## 4. Gates

Auth is the one area where the e2e suite is _not_ the safety net in this container: the `basic`
fixture's api-key tests need an SMTP sink on `127.0.0.1:1025`, and its panel tests need a Chromium
that matches Playwright.

```bash
bun run test:basic       # 85 pass / 12 fail is baseline here: 8 Chromium, 4 api-key (no SMTP)
```

So verify auth changes with, in order:

1. **`bun run test:versions`** — has a `staff` collection with roles and a sign-in in every test.
2. **The browser probe** (`probing.md` §7) — sign in, and confirm a non-super-admin sees what it
   should. `isSuperAdmin` and `getUserAttributes` are both access decisions; getting one wrong
   fails _open_, and no assertion in the suite would notice.
3. **`bun run test:basic` on a machine with SMTP and a matching Chromium**, before landing.

> A wrong answer from `isSuperAdmin` is a privilege escalation, not a bug. Treat every change in
> this annex as security-relevant and probe it in a browser rather than reasoning about it.

---

## 5. What shipped

Seven members down to one, in two commits. `auth.server.ts` is 35 lines and builds
`drizzleAdapter(...)`; nothing else.

### 5.1 §2.1 landed as written

`features/auth/user.server.ts`, three functions taking the adapter. `STAFF_SLUG` lives in
`features/auth/tables.ts` — the file §4.2 created, which is also where the super-admin column is
declared, so the two statements about that collection sit together.

One departure: `userAttributes` **names the members it returns** rather than spreading the row.
The hand-written `db.select()` named them too, and going through `findMany` would otherwise have
carried `contentId` onto `event.locals.user` for a shadowed auth collection. What reaches the
client through `toPublicUser` is a decision, not whatever the read happened to return.

`isSuperAdmin` filters on the id and the flag together rather than fetching the row and testing it.
Same answer, and it does not bring the row back to a caller that only asked a yes/no question.

### 5.2 §2.2 is option (a). Option (b) is closed.

**Better-auth's admin API cannot serve any of the three.** `listUsers`, `setRole` and `removeUser`
are all `use: [adminMiddleware]`, and every caller runs where no admin session exists:

| call              | when it runs                              | why the admin API refuses    |
| ----------------- | ----------------------------------------- | ---------------------------- |
| `hasAuthUser`     | gates the init route — no user exists yet | no session to authorize      |
| `setAuthUserRole` | promotes the very first signup to admin   | no admin exists to authorize |
| `deleteAuthUser`  | rolls back a failed signup                | `YOU_CANNOT_REMOVE_YOURSELF` |

`removeUser` _does_ delete sessions before the user, so the security property §2.2 asked about
holds on its side — but it is unreachable from here regardless. `hooks.server.ts` already carried
the finding as a comment: "would be cleaner to do it with the admin plugin, not possible at the
moment". It is written down with the reason now, so nobody re-reads better-auth to find out.

So: `adapter.table(slug)`, three verbs and a flat column-to-value filter.

```ts
export interface TableHandle {
  find(args?: { where?: Dic; select?: string[]; limit?: number }): Promise<Dic[]>;
  update(args: { where: Dic; data: Dic }): Promise<void>;
  delete(args: { where: Dic }): Promise<void>;
}
```

§2.2 called this "a second read/write surface to maintain", which is the honest cost. What makes it
small is that a declared table has no config behind it — no path resolution, no locales branch, no
children, no blank — so it does not grow toward `PrototypeHandle`. `update` and `delete` refuse an
empty `where`: drizzle's `and()` of nothing is `undefined`, and a write with no `WHERE` is never
what a caller meant.

### 5.3 The gate §4 asked for, and the one it could not

§4 is right that the e2e suite is the net and that these fail _open_. Both commits therefore carry
specs that assert **the call, not the result** — the slug, the filter, the projection, and for
`deleteAuthUser` the order. `user.spec.ts` was proved by breaking it: dropping the `isSuperAdmin`
condition fails exactly one test.

`bun run test:basic` ran green on a machine with SMTP and a matching Chromium, which is what §4
asked for before landing.
