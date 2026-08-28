# rimecms

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
