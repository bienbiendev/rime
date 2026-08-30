# rimecms

## 0.31.4

### Patch Changes

- [`684a43e`](https://github.com/bienbiendev/rime/commit/684a43e229e618a073cf700b48b0b94f92b150af) - Added: Custom config directory under `RIME_CONFIG_DIR` env var

- [`684a43e`](https://github.com/bienbiendev/rime/commit/684a43e229e618a073cf700b48b0b94f92b150af) - Breaking Change: Default config directory path is now `src/+rime`, you may add `RIME_CONFIG_DIR=src/lib/+rime` to .env, if yours differs.

- [`b14a276`](https://github.com/bienbiendev/rime/commit/b14a27687bf14ffa353aca73e852164cdbad90c3) - Upgrade `better-auth` from `1.4.21` to `1.7.1`.

  The `apiKey` plugin now ships as the separate `@better-auth/api-key` package. The generated `auth_accounts` table gains a required `issuer` column and renames `account_id` to `provider_account_id`; the generated `apikey` table renames `user_id` to `reference_id` and adds `config_id`.

  There is no automated data migration. Upgrading requires dropping and recreating the `auth_accounts` and `apikey` tables (or resetting the dev database) and re-creating users.

## 0.31.3

### Patch Changes

- Fixed: custom collection CustomHeaderComponent fails to retrieve the collection context

- Fixed: make argument optionnal for local api collection methods `delete` and `find`

## 0.31.2

### Patch Changes

- [`3e6d1b0`](https://github.com/bienbiendev/rime/commit/3e6d1b02fe76d1706d1336a8863d10129e8d055d) - Breaking Change: Drop collection context `addDoc|updateDoc|deleteDoc``methods

- [`3e6d1b0`](https://github.com/bienbiendev/rime/commit/3e6d1b02fe76d1706d1336a8863d10129e8d055d) - Breaking Change: Drop getCollectionContext KEY argument

- [`3e6d1b0`](https://github.com/bienbiendev/rime/commit/3e6d1b02fe76d1706d1336a8863d10129e8d055d) - Added: Expose `CONTEXT.<NAME>` under `rimecms/panel` to allow simpler context retrieval ex: `getContext(CONTEXT.COLLECTION)` from consumer libs.

- [`3e6d1b0`](https://github.com/bienbiendev/rime/commit/3e6d1b02fe76d1706d1336a8863d10129e8d055d) - Breaking Change: Drop getAPIProxyContext KEY argument

## 0.31.1

### Patch Changes

- Fixed: `module.(server.)ts` pairs not resolve at root src/lib
- Fixed: `$rime/modules` types not generated on `rime generate` command
