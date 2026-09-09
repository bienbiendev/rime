# Pipelines

One table per timing, in the order the hooks actually run. **`#` is computed** — from
`requires` and `provides`, never from a written list — so those two columns are what to
read when a hook lands somewhere unexpected. A `requires` naming something no `provides`
above it mentions is satisfied _silently_, which is the one failure this file exists to make
visible.

`from` is the prototype, or the feature that contributed the hook. `anonymous` is a hook
your config contributed without naming it — every rime-owned hook is named.

Marks are namespaced: `__name` is rime's, `owner:name` is everyone else's, and anything
else throws at boot. See `src/lib/core/pipeline/marks.ts`.

## pages (collection)

### beforeOperation

| #   | hook        | from       | requires | provides |
| --- | ----------- | ---------- | -------- | -------- |
| 1   | `authorize` | collection | —        | —        |

### beforeRead

| #   | hook                    | from       | requires                | provides                |
| --- | ----------------------- | ---------- | ----------------------- | ----------------------- |
| 1   | `processDocumentFields` | collection | `__sanitized`           | `__shaped` `__document` |
| 2   | `setDocumentLocale`     | collection | `__shaped`              | `__document`            |
| 3   | `setDocumentType`       | collection | `__shaped`              | `__document`            |
| 4   | `addChildrenProperty`   | nested     | `__shaped`              | `__document`            |
| 5   | `setDocumentTitle`      | title      | `__shaped`              | `__title` `__document`  |
| 6   | `populateURL`           | url        | `__shaped` `__title`    | `__document`            |
| 7   | `anonymous`             | collection | `__shaped`              | `__document`            |
| 8   | `setDocumentThumbnail`  | thumbnail  | `__shaped` `__document` | `__document`            |
| 9   | `sortDocumentProps`     | collection | `__document`            | —                       |

### beforeCreate

| #   | hook                     | from       | requires                             | provides                           |
| --- | ------------------------ | ---------- | ------------------------------------ | ---------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                    | `__blank-merged` `__config-fields` |
| 2   | `buildDataConfigMap`     | collection | `__config-fields` `__data-inspected` | `__config-map`                     |
| 3   | `setDefaultValues`       | collection | `__config-map`                       | —                                  |
| 4   | `validateFields`         | collection | `__config-map`                       | `__validated`                      |
| 5   | `anonymous`              | collection | `__validated`                        | —                                  |

### afterCreate

| #   | hook        | from       | requires | provides |
| --- | ----------- | ---------- | -------- | -------- |
| 1   | `anonymous` | collection | —        | —        |

### beforeUpdate

| #   | hook                        | from       | requires                             | provides                |
| --- | --------------------------- | ---------- | ------------------------------------ | ----------------------- |
| 1   | `getOriginalDocument`       | collection | —                                    | `__original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `__original-doc`                     | `__original-config-map` |
| 3   | `resolveContentOwner`       | collection | `__original-doc`                     | `__content-owner`       |
| 4   | `buildDataConfigMap`        | collection | `__config-fields` `__data-inspected` | `__config-map`          |
| 5   | `setDefaultValues`          | collection | `__config-map`                       | —                       |
| 6   | `validateFields`            | collection | `__config-map`                       | `__validated`           |
| 7   | `anonymous`                 | collection | `__validated`                        | —                       |

### afterUpdate

| #   | hook        | from       | requires | provides |
| --- | ----------- | ---------- | -------- | -------- |
| 1   | `anonymous` | collection | —        | —        |

## medias (collection)

### beforeOperation

| #   | hook        | from       | requires | provides |
| --- | ----------- | ---------- | -------- | -------- |
| 1   | `authorize` | collection | —        | —        |

### beforeRead

| #   | hook                    | from       | requires                | provides                |
| --- | ----------------------- | ---------- | ----------------------- | ----------------------- |
| 1   | `processDocumentFields` | collection | `__sanitized`           | `__shaped` `__document` |
| 2   | `setDocumentLocale`     | collection | `__shaped`              | `__document`            |
| 3   | `setDocumentType`       | collection | `__shaped`              | `__document`            |
| 4   | `populateSizes`         | upload     | `__shaped`              | `__document`            |
| 5   | `setDocumentTitle`      | title      | `__shaped`              | `__title` `__document`  |
| 6   | `setDocumentThumbnail`  | thumbnail  | `__shaped` `__document` | `__document`            |
| 7   | `sortDocumentProps`     | collection | `__document`            | —                       |

### beforeCreate

| #   | hook                     | from       | requires                             | provides                           |
| --- | ------------------------ | ---------- | ------------------------------------ | ---------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                    | `__blank-merged` `__config-fields` |
| 2   | `buildDataConfigMap`     | collection | `__config-fields` `__data-inspected` | `__config-map`                     |
| 3   | `setDefaultValues`       | collection | `__config-map`                       | —                                  |
| 4   | `validateFields`         | collection | `__config-map`                       | `__validated`                      |
| 5   | `handlePathCreation`     | upload     | `__validated`                        | —                                  |
| 6   | `castBase64ToFile`       | upload     | `__validated`                        | —                                  |
| 7   | `processFileUpload`      | upload     | `__validated`                        | —                                  |

### beforeUpdate

| #   | hook                        | from       | requires                             | provides                |
| --- | --------------------------- | ---------- | ------------------------------------ | ----------------------- |
| 1   | `getOriginalDocument`       | collection | —                                    | `__original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `__original-doc`                     | `__original-config-map` |
| 3   | `resolveContentOwner`       | collection | `__original-doc`                     | `__content-owner`       |
| 4   | `buildDataConfigMap`        | collection | `__config-fields` `__data-inspected` | `__config-map`          |
| 5   | `setDefaultValues`          | collection | `__config-map`                       | —                       |
| 6   | `validateFields`            | collection | `__config-map`                       | `__validated`           |
| 7   | `handlePathCreation`        | upload     | `__validated`                        | —                       |
| 8   | `castBase64ToFile`          | upload     | `__validated`                        | —                       |
| 9   | `processFileUpload`         | upload     | `__validated`                        | —                       |

### beforeDelete

| #   | hook           | from   | requires | provides |
| --- | -------------- | ------ | -------- | -------- |
| 1   | `cleanUpFiles` | upload | —        | —        |

## news (collection)

### beforeOperation

| #   | hook        | from       | requires | provides |
| --- | ----------- | ---------- | -------- | -------- |
| 1   | `authorize` | collection | —        | —        |

### beforeRead

| #   | hook                    | from       | requires                | provides                |
| --- | ----------------------- | ---------- | ----------------------- | ----------------------- |
| 1   | `processDocumentFields` | collection | `__sanitized`           | `__shaped` `__document` |
| 2   | `setDocumentLocale`     | collection | `__shaped`              | `__document`            |
| 3   | `setDocumentType`       | collection | `__shaped`              | `__document`            |
| 4   | `setDocumentTitle`      | title      | `__shaped`              | `__title` `__document`  |
| 5   | `populateURL`           | url        | `__shaped` `__title`    | `__document`            |
| 6   | `setDocumentThumbnail`  | thumbnail  | `__shaped` `__document` | `__document`            |
| 7   | `sortDocumentProps`     | collection | `__document`            | —                       |

### beforeCreate

| #   | hook                     | from       | requires                             | provides                           |
| --- | ------------------------ | ---------- | ------------------------------------ | ---------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                    | `__blank-merged` `__config-fields` |
| 2   | `buildDataConfigMap`     | collection | `__config-fields` `__data-inspected` | `__config-map`                     |
| 3   | `setDefaultValues`       | collection | `__config-map`                       | —                                  |
| 4   | `validateFields`         | collection | `__config-map`                       | `__validated`                      |

### beforeUpdate

| #   | hook                        | from       | requires                             | provides                |
| --- | --------------------------- | ---------- | ------------------------------------ | ----------------------- |
| 1   | `getOriginalDocument`       | collection | —                                    | `__original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `__original-doc`                     | `__original-config-map` |
| 3   | `resolveContentOwner`       | collection | `__original-doc`                     | `__content-owner`       |
| 4   | `buildDataConfigMap`        | collection | `__config-fields` `__data-inspected` | `__config-map`          |
| 5   | `setDefaultValues`          | collection | `__config-map`                       | —                       |
| 6   | `validateFields`            | collection | `__config-map`                       | `__validated`           |

## users (collection)

### beforeOperation

| #   | hook        | from       | requires | provides |
| --- | ----------- | ---------- | -------- | -------- |
| 1   | `authorize` | collection | —        | —        |

### beforeRead

| #   | hook                    | from       | requires                | provides                |
| --- | ----------------------- | ---------- | ----------------------- | ----------------------- |
| 1   | `removePrivateFields`   | auth       | —                       | `__sanitized`           |
| 2   | `processDocumentFields` | collection | `__sanitized`           | `__shaped` `__document` |
| 3   | `setDocumentLocale`     | collection | `__shaped`              | `__document`            |
| 4   | `setDocumentType`       | collection | `__shaped`              | `__document`            |
| 5   | `setDocumentTitle`      | title      | `__shaped`              | `__title` `__document`  |
| 6   | `setDocumentThumbnail`  | thumbnail  | `__shaped` `__document` | `__document`            |
| 7   | `sortDocumentProps`     | collection | `__document`            | —                       |

### beforeCreate

| #   | hook                     | from       | requires                             | provides                           |
| --- | ------------------------ | ---------- | ------------------------------------ | ---------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                    | `__blank-merged` `__config-fields` |
| 2   | `augmentFieldsPassword`  | auth       | `__blank-merged`                     | `__config-fields`                  |
| 3   | `buildDataConfigMap`     | collection | `__config-fields` `__data-inspected` | `__config-map`                     |
| 4   | `setDefaultValues`       | collection | `__config-map`                       | —                                  |
| 5   | `validateFields`         | collection | `__config-map`                       | `__validated`                      |
| 6   | `createBetterAuthUser`   | auth       | `__validated`                        | —                                  |

### afterCreate

| #   | hook             | from | requires | provides |
| --- | ---------------- | ---- | -------- | -------- |
| 1   | `populateAPIKey` | auth | —        | —        |

### beforeUpdate

| #   | hook                        | from       | requires                             | provides                |
| --- | --------------------------- | ---------- | ------------------------------------ | ----------------------- |
| 1   | `getOriginalDocument`       | collection | —                                    | `__original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `__original-doc`                     | `__original-config-map` |
| 3   | `resolveContentOwner`       | collection | `__original-doc`                     | `__content-owner`       |
| 4   | `augmentFieldsPassword`     | auth       | `__blank-merged`                     | `__config-fields`       |
| 5   | `preventSuperAdminMutation` | auth       | `__original-doc`                     | `__data-inspected`      |
| 6   | `preventUserMutations`      | auth       | `__original-doc`                     | `__data-inspected`      |
| 7   | `forwardRolesToBetterAuth`  | auth       | `__original-doc`                     | `__data-inspected`      |
| 8   | `buildDataConfigMap`        | collection | `__config-fields` `__data-inspected` | `__config-map`          |
| 9   | `setDefaultValues`          | collection | `__config-map`                       | —                       |
| 10  | `validateFields`            | collection | `__config-map`                       | `__validated`           |

### beforeDelete

| #   | hook                         | from | requires | provides |
| --- | ---------------------------- | ---- | -------- | -------- |
| 1   | `preventSupperAdminDeletion` | auth | —        | —        |

### afterDelete

| #   | hook                   | from | requires | provides |
| --- | ---------------------- | ---- | -------- | -------- |
| 1   | `deleteBetterAuthUser` | auth | —        | —        |

## apps (collection)

### beforeOperation

| #   | hook        | from       | requires | provides |
| --- | ----------- | ---------- | -------- | -------- |
| 1   | `authorize` | collection | —        | —        |

### beforeRead

| #   | hook                    | from       | requires                | provides                |
| --- | ----------------------- | ---------- | ----------------------- | ----------------------- |
| 1   | `removePrivateFields`   | auth       | —                       | `__sanitized`           |
| 2   | `processDocumentFields` | collection | `__sanitized`           | `__shaped` `__document` |
| 3   | `setDocumentLocale`     | collection | `__shaped`              | `__document`            |
| 4   | `setDocumentType`       | collection | `__shaped`              | `__document`            |
| 5   | `setDocumentTitle`      | title      | `__shaped`              | `__title` `__document`  |
| 6   | `setDocumentThumbnail`  | thumbnail  | `__shaped` `__document` | `__document`            |
| 7   | `sortDocumentProps`     | collection | `__document`            | —                       |

### beforeCreate

| #   | hook                     | from       | requires                             | provides                           |
| --- | ------------------------ | ---------- | ------------------------------------ | ---------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                    | `__blank-merged` `__config-fields` |
| 2   | `augmentFieldsPassword`  | auth       | `__blank-merged`                     | `__config-fields`                  |
| 3   | `buildDataConfigMap`     | collection | `__config-fields` `__data-inspected` | `__config-map`                     |
| 4   | `setDefaultValues`       | collection | `__config-map`                       | —                                  |
| 5   | `validateFields`         | collection | `__config-map`                       | `__validated`                      |
| 6   | `createBetterAuthUser`   | auth       | `__validated`                        | —                                  |

### afterCreate

| #   | hook             | from | requires | provides |
| --- | ---------------- | ---- | -------- | -------- |
| 1   | `populateAPIKey` | auth | —        | —        |

### beforeUpdate

| #   | hook                        | from       | requires                             | provides                |
| --- | --------------------------- | ---------- | ------------------------------------ | ----------------------- |
| 1   | `getOriginalDocument`       | collection | —                                    | `__original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `__original-doc`                     | `__original-config-map` |
| 3   | `resolveContentOwner`       | collection | `__original-doc`                     | `__content-owner`       |
| 4   | `augmentFieldsPassword`     | auth       | `__blank-merged`                     | `__config-fields`       |
| 5   | `preventSuperAdminMutation` | auth       | `__original-doc`                     | `__data-inspected`      |
| 6   | `preventUserMutations`      | auth       | `__original-doc`                     | `__data-inspected`      |
| 7   | `forwardRolesToBetterAuth`  | auth       | `__original-doc`                     | `__data-inspected`      |
| 8   | `buildDataConfigMap`        | collection | `__config-fields` `__data-inspected` | `__config-map`          |
| 9   | `setDefaultValues`          | collection | `__config-map`                       | —                       |
| 10  | `validateFields`            | collection | `__config-map`                       | `__validated`           |

### beforeDelete

| #   | hook                         | from | requires | provides |
| --- | ---------------------------- | ---- | -------- | -------- |
| 1   | `preventSupperAdminDeletion` | auth | —        | —        |

### afterDelete

| #   | hook                   | from | requires | provides |
| --- | ---------------------- | ---- | -------- | -------- |
| 1   | `deleteBetterAuthUser` | auth | —        | —        |

## staff (collection)

### beforeOperation

| #   | hook        | from       | requires | provides |
| --- | ----------- | ---------- | -------- | -------- |
| 1   | `authorize` | collection | —        | —        |

### beforeRead

| #   | hook                    | from       | requires                | provides                |
| --- | ----------------------- | ---------- | ----------------------- | ----------------------- |
| 1   | `removePrivateFields`   | auth       | —                       | `__sanitized`           |
| 2   | `processDocumentFields` | collection | `__sanitized`           | `__shaped` `__document` |
| 3   | `setDocumentLocale`     | collection | `__shaped`              | `__document`            |
| 4   | `setDocumentType`       | collection | `__shaped`              | `__document`            |
| 5   | `setDocumentTitle`      | title      | `__shaped`              | `__title` `__document`  |
| 6   | `setDocumentThumbnail`  | thumbnail  | `__shaped` `__document` | `__document`            |
| 7   | `sortDocumentProps`     | collection | `__document`            | —                       |

### beforeCreate

| #   | hook                     | from       | requires                             | provides                           |
| --- | ------------------------ | ---------- | ------------------------------------ | ---------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                    | `__blank-merged` `__config-fields` |
| 2   | `augmentFieldsPassword`  | auth       | `__blank-merged`                     | `__config-fields`                  |
| 3   | `buildDataConfigMap`     | collection | `__config-fields` `__data-inspected` | `__config-map`                     |
| 4   | `setDefaultValues`       | collection | `__config-map`                       | —                                  |
| 5   | `validateFields`         | collection | `__config-map`                       | `__validated`                      |
| 6   | `createBetterAuthUser`   | auth       | `__validated`                        | —                                  |

### afterCreate

| #   | hook             | from | requires | provides |
| --- | ---------------- | ---- | -------- | -------- |
| 1   | `populateAPIKey` | auth | —        | —        |

### beforeUpdate

| #   | hook                        | from       | requires                             | provides                |
| --- | --------------------------- | ---------- | ------------------------------------ | ----------------------- |
| 1   | `getOriginalDocument`       | collection | —                                    | `__original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `__original-doc`                     | `__original-config-map` |
| 3   | `resolveContentOwner`       | collection | `__original-doc`                     | `__content-owner`       |
| 4   | `augmentFieldsPassword`     | auth       | `__blank-merged`                     | `__config-fields`       |
| 5   | `preventSuperAdminMutation` | auth       | `__original-doc`                     | `__data-inspected`      |
| 6   | `preventUserMutations`      | auth       | `__original-doc`                     | `__data-inspected`      |
| 7   | `forwardRolesToBetterAuth`  | auth       | `__original-doc`                     | `__data-inspected`      |
| 8   | `buildDataConfigMap`        | collection | `__config-fields` `__data-inspected` | `__config-map`          |
| 9   | `setDefaultValues`          | collection | `__config-map`                       | —                       |
| 10  | `validateFields`            | collection | `__config-map`                       | `__validated`           |

### beforeDelete

| #   | hook                         | from | requires | provides |
| --- | ---------------------------- | ---- | -------- | -------- |
| 1   | `preventSupperAdminDeletion` | auth | —        | —        |

### afterDelete

| #   | hook                   | from | requires | provides |
| --- | ---------------------- | ---- | -------- | -------- |
| 1   | `deleteBetterAuthUser` | auth | —        | —        |

## $mediasDirectories (collection)

### beforeOperation

| #   | hook        | from       | requires | provides |
| --- | ----------- | ---------- | -------- | -------- |
| 1   | `authorize` | collection | —        | —        |

### beforeRead

| #   | hook                    | from       | requires                | provides                |
| --- | ----------------------- | ---------- | ----------------------- | ----------------------- |
| 1   | `processDocumentFields` | collection | `__sanitized`           | `__shaped` `__document` |
| 2   | `setDocumentLocale`     | collection | `__shaped`              | `__document`            |
| 3   | `setDocumentType`       | collection | `__shaped`              | `__document`            |
| 4   | `setDocumentTitle`      | title      | `__shaped`              | `__title` `__document`  |
| 5   | `setDocumentThumbnail`  | thumbnail  | `__shaped` `__document` | `__document`            |
| 6   | `sortDocumentProps`     | collection | `__document`            | —                       |

### beforeCreate

| #   | hook                     | from       | requires                             | provides                           |
| --- | ------------------------ | ---------- | ------------------------------------ | ---------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                    | `__blank-merged` `__config-fields` |
| 2   | `buildDataConfigMap`     | collection | `__config-fields` `__data-inspected` | `__config-map`                     |
| 3   | `setDefaultValues`       | collection | `__config-map`                       | —                                  |
| 4   | `validateFields`         | collection | `__config-map`                       | `__validated`                      |
| 5   | `exctractPath`           | collection | —                                    | —                                  |

### beforeUpdate

| #   | hook                        | from       | requires                             | provides                |
| --- | --------------------------- | ---------- | ------------------------------------ | ----------------------- |
| 1   | `getOriginalDocument`       | collection | —                                    | `__original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `__original-doc`                     | `__original-config-map` |
| 3   | `resolveContentOwner`       | collection | `__original-doc`                     | `__content-owner`       |
| 4   | `buildDataConfigMap`        | collection | `__config-fields` `__data-inspected` | `__config-map`          |
| 5   | `setDefaultValues`          | collection | `__config-map`                       | —                       |
| 6   | `validateFields`            | collection | `__config-map`                       | `__validated`           |
| 7   | `exctractPath`              | collection | —                                    | —                       |
| 8   | `prepareDirectoryChildren`  | collection | —                                    | —                       |

### afterUpdate

| #   | hook                      | from       | requires | provides |
| --- | ------------------------- | ---------- | -------- | -------- |
| 1   | `updateDirectoryChildren` | collection | —        | —        |

## settings (area)

### beforeOperation

| #   | hook        | from | requires | provides |
| --- | ----------- | ---- | -------- | -------- |
| 1   | `authorize` | area | —        | —        |

### beforeRead

| #   | hook                    | from  | requires      | provides                |
| --- | ----------------------- | ----- | ------------- | ----------------------- |
| 1   | `processDocumentFields` | area  | `__sanitized` | `__shaped` `__document` |
| 2   | `setDocumentLocale`     | area  | `__shaped`    | `__document`            |
| 3   | `setDocumentType`       | area  | `__shaped`    | `__document`            |
| 4   | `setDocumentTitle`      | title | `__shaped`    | `__title` `__document`  |
| 5   | `sortDocumentProps`     | area  | `__document`  | —                       |

### beforeUpdate

| #   | hook                        | from | requires                             | provides                |
| --- | --------------------------- | ---- | ------------------------------------ | ----------------------- |
| 1   | `getOriginalDocument`       | area | —                                    | `__original-doc`        |
| 2   | `buildOriginalDocConfigMap` | area | `__original-doc`                     | `__original-config-map` |
| 3   | `resolveContentOwner`       | area | `__original-doc`                     | `__content-owner`       |
| 4   | `buildDataConfigMap`        | area | `__config-fields` `__data-inspected` | `__config-map`          |
| 5   | `setDefaultValues`          | area | `__config-map`                       | —                       |
| 6   | `validateFields`            | area | `__config-map`                       | `__validated`           |

## navigation (area)

### beforeOperation

| #   | hook        | from | requires | provides |
| --- | ----------- | ---- | -------- | -------- |
| 1   | `authorize` | area | —        | —        |

### beforeRead

| #   | hook                    | from  | requires      | provides                |
| --- | ----------------------- | ----- | ------------- | ----------------------- |
| 1   | `processDocumentFields` | area  | `__sanitized` | `__shaped` `__document` |
| 2   | `setDocumentLocale`     | area  | `__shaped`    | `__document`            |
| 3   | `setDocumentType`       | area  | `__shaped`    | `__document`            |
| 4   | `setDocumentTitle`      | title | `__shaped`    | `__title` `__document`  |
| 5   | `sortDocumentProps`     | area  | `__document`  | —                       |

### beforeUpdate

| #   | hook                        | from | requires                             | provides                |
| --- | --------------------------- | ---- | ------------------------------------ | ----------------------- |
| 1   | `getOriginalDocument`       | area | —                                    | `__original-doc`        |
| 2   | `buildOriginalDocConfigMap` | area | `__original-doc`                     | `__original-config-map` |
| 3   | `resolveContentOwner`       | area | `__original-doc`                     | `__content-owner`       |
| 4   | `buildDataConfigMap`        | area | `__config-fields` `__data-inspected` | `__config-map`          |
| 5   | `setDefaultValues`          | area | `__config-map`                       | —                       |
| 6   | `validateFields`            | area | `__config-map`                       | `__validated`           |

## infos (area)

### beforeOperation

| #   | hook        | from | requires | provides |
| --- | ----------- | ---- | -------- | -------- |
| 1   | `authorize` | area | —        | —        |

### beforeRead

| #   | hook                    | from  | requires      | provides                |
| --- | ----------------------- | ----- | ------------- | ----------------------- |
| 1   | `processDocumentFields` | area  | `__sanitized` | `__shaped` `__document` |
| 2   | `setDocumentLocale`     | area  | `__shaped`    | `__document`            |
| 3   | `setDocumentType`       | area  | `__shaped`    | `__document`            |
| 4   | `setDocumentTitle`      | title | `__shaped`    | `__title` `__document`  |
| 5   | `sortDocumentProps`     | area  | `__document`  | —                       |

### beforeUpdate

| #   | hook                        | from | requires                             | provides                |
| --- | --------------------------- | ---- | ------------------------------------ | ----------------------- |
| 1   | `getOriginalDocument`       | area | —                                    | `__original-doc`        |
| 2   | `buildOriginalDocConfigMap` | area | `__original-doc`                     | `__original-config-map` |
| 3   | `resolveContentOwner`       | area | `__original-doc`                     | `__content-owner`       |
| 4   | `buildDataConfigMap`        | area | `__config-fields` `__data-inspected` | `__config-map`          |
| 5   | `setDefaultValues`          | area | `__config-map`                       | —                       |
| 6   | `validateFields`            | area | `__config-map`                       | `__validated`           |
