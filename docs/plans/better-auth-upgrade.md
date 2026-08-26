# Upgrade better-auth 1.4.21 → 1.7.1

## Context

rime pins `better-auth` at an exact `1.4.21` (no semver range) as a direct dependency. Between 1.4.21 and 1.7.1, better-auth shipped three breaking-change boundaries (v1.5.0, v1.6.0, v1.7.0). rime is pre-1.0 (v0.30.3), has no built-in DB migration/upgrade tooling for consumer apps, and hand-duplicates better-auth's expected table shapes in `generate-schema/templates.server.ts` rather than using better-auth's own `generate`/`migrate` CLI. The user confirmed: no backfill migration script is needed — for the account-issuer schema change, dropping/recreating the affected auth tables and re-creating users is an acceptable path at this stage. Single upgrade straight to 1.7.1, not staged milestones.

rime's actual usage surface is narrow: `betterAuth()` core + `admin` plugin + `apiKey` plugin, `drizzleAdapter`, custom `hooks.before`/`hooks.after` via `createAuthMiddleware`, `better-auth/svelte` client + `better-auth/svelte-kit` handler, and direct calls to `auth.api.{createUser,createApiKey,removeUser,deleteApiKey,setRole,signInEmail}`. No social providers, OIDC/OAuth-provider, MCP, SSO, 2FA, captcha, SCIM, secondary storage, or `experimental.joins` — so the large majority of the 1.7.0 breaking-change list (device grant, MCP split, back-channel logout, generic-OAuth rewrite, Microsoft Entra `oid`, Google One Tap, Electron PKCE, SCIM decoupling, etc.) is not applicable and needs no code change, just confirmation nothing regresses.

## Breaking changes that actually apply to rime

1. **v1.5.0 — `apiKey` plugin moved to `@better-auth/api-key`** (new dependency required). Schema: `ApiKey.userId` → `ApiKey.referenceId`, new `ApiKey.configId` (default `"default"`). Client plugin `apiKeyClient` also moves out of `better-auth/client/plugins`.
2. **v1.5.0 — deprecated API removals**: `better-auth/adapters/test`, `/forget-password/email-otp`, old `createAdapter`/`Adapter`/`TransactionAdapter` type exports, `@better-auth/core/utils` barrel, `InferUser`/`InferSession`. Grep confirms rime doesn't use any of these — verify during upgrade, no code change expected.
3. **v1.6.0 — `freshAge` now computed from `createdAt`** instead of update time. rime doesn't configure `session.freshAge`, so this is a silent behavior change worth a regression check, not a code change.
4. **v1.7.0 — account scoped by issuer (the big one)**: `Account.accountId` → `Account.providerAccountId`, new required `Account.issuer`. Hits `authAccounts` regardless of provider (credential accounts use `local:credential`).
5. **v1.7.0 — origin resolution from `Host` header when `baseURL` is dynamic**: rime sets a static `baseURL: env.PUBLIC_RIME_URL`, so this default shouldn't engage — confirm via testing, no code change expected unless rime is deployed behind a proxy that doesn't rewrite `Host`.

## Implementation

**Dependencies** (`package.json`)
- Bump `better-auth` to `1.7.1`.
- Add `@better-auth/api-key` at `1.7.1`.

**apiKey plugin migration**
- [src/lib/core/config/auth/better-auth.server.ts](src/lib/core/config/auth/better-auth.server.ts): change `import { apiKey } from 'better-auth/plugins'` → `import { apiKey } from '@better-auth/api-key'`. Verify the `permissions.defaultPermissions` object form (`{ roles: [...] }`, not a callback) is still accepted by the new package — check its shipped types after install.
- [src/lib/panel/util/auth.ts](src/lib/panel/util/auth.ts): update `apiKeyClient` import to wherever `@better-auth/api-key` ships its client plugin (check its `package.json` exports map — likely `@better-auth/api-key/client`).
- [src/lib/core/collections/auth/hooks/before-create/create-better-auth-user.server.ts](src/lib/core/collections/auth/hooks/before-create/create-better-auth-user.server.ts) line ~160-168: `rime.auth.api.createApiKey({ body: { name, userId: ..., permissions } })` — check the new package's `createApiKey` body type; rename `userId` → `referenceId` if the API surface renamed it too (not just the DB column).

**Schema template** ([src/lib/adapter-sqlite/generate-schema/templates.server.ts](src/lib/adapter-sqlite/generate-schema/templates.server.ts))
- `templateAuth` → `authAccounts` (line ~308-324): rename `accountId` field/column to `providerAccountId` (`provider_account_id`), add `issuer: text('issuer').notNull()`.
- `templateAPIKey` (line ~336-360): rename `userId` field/column to `referenceId` (`reference_id`), add `configId: text('config_id').notNull().default('default')`.
- This file is the source of truth consumers use to generate their Drizzle schema (and what rime's own `tests/basic` fixtures regenerate from) — no other hand-duplicated copy exists elsewhere in the repo (confirmed via grep).

**Runtime code checks** (no expected changes, verify against new types)
- [src/lib/adapter-sqlite/auth.server.ts](src/lib/adapter-sqlite/auth.server.ts): `drizzleAdapter` schema mapping (`user`/`session`/`account`/`verification` → rime's renamed tables) — confirm the adapter still accepts this shape with the new `account` columns.
- [src/lib/core/config/auth/better-auth-hooks.server.ts](src/lib/core/config/auth/better-auth-hooks.server.ts): direct deletes against `authAccounts`/`authSessions`/`authUsers` by `userId` on sign-up rollback (line ~123-128) — unaffected by the rename since it filters by `userId`, not `accountId`.
- [src/lib/core/collections/auth/hooks/before-update/forward-roles.server.ts](src/lib/core/collections/auth/hooks/before-update/forward-roles.server.ts): `rime.auth.api.setRole` — not mentioned in any breaking-change notes, low risk, exercise in testing.
- [src/lib/panel/pages/auth/sign-in/actions.server.ts]: hand-rolled `Set-Cookie` relay around `rime.auth.api.signInEmail` — check cookie attribute/shape hasn't changed upstream (not called out in release notes, but it's a raw header parse so worth a manual sign-in test).
- `better-auth/svelte`, `better-auth/svelte-kit`, `better-auth/api`, `better-auth/plugins/access`, `better-auth/plugins/admin/access` subpath imports — no renames mentioned for these in the scanned release notes; confirm they still resolve after the bump (TypeScript build will catch any that don't).

**Breaking-change migration path for existing consumer apps**
- Since there's no backfill script: document in rime's changelog/upgrade notes that upgrading past this version requires dropping and recreating `auth_accounts` and `apikey` tables (or a full dev-DB reset) and re-creating users — consistent with rime's pre-1.0 posture and the user's confirmed approach. No migration SQL needs to be authored.

## Verification

1. `pnpm install` to pull `better-auth@1.7.1` + `@better-auth/api-key@1.7.1`.
2. Type-check (`pnpm check` or equivalent) — surfaces any subpath-import breakage or type-signature mismatches immediately (e.g. `createApiKey`, `apiKeyClient` import path, `defaultPermissions` shape).
3. Regenerate the test fixture schema (`tests/basic`) from the updated `templates.server.ts` and confirm `authAccounts`/`apikey` tables come out with `providerAccountId`/`issuer`/`referenceId`/`configId`.
4. Run rime's test suite — **user runs this themselves**, not Claude (per prior guidance: never run `pnpm test`/dev server directly).
5. Manual smoke test via the panel (user-driven, or `/run` skill if desired): first-user init flow, admin creating a user, staff creating a user, public sign-up, sign-in (verify the manual cookie relay still sets a working session cookie), password reset request + reset, API key creation + email delivery + deletion, role forwarding on user update, session/account rollback path on a failed sign-up.
