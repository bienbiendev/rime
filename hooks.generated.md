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

| #   | hook                    | from       | requires                      | provides                      |
| --- | ----------------------- | ---------- | ----------------------------- | ----------------------------- |
| 1   | `processDocumentFields` | collection | `core:sanitized`              | `core:shaped` `core:document` |
| 2   | `setDocumentLocale`     | collection | `core:shaped`                 | `core:document`               |
| 3   | `setDocumentType`       | collection | `core:shaped`                 | `core:document`               |
| 4   | `addChildrenProperty`   | nested     | `core:shaped`                 | `core:document`               |
| 5   | `setDocumentTitle`      | title      | `core:shaped`                 | `core:title` `core:document`  |
| 6   | `populateURL`           | url        | `core:shaped` `core:title`    | `core:document`               |
| 7   | `anonymous`             | collection | `core:shaped`                 | `core:document`               |
| 8   | `setDocumentThumbnail`  | thumbnail  | `core:shaped` `core:document` | `core:document`               |
| 9   | `sortDocumentProps`     | collection | `core:document`               | —                             |

### beforeCreate

| #   | hook                     | from       | requires                                   | provides                                 |
| --- | ------------------------ | ---------- | ------------------------------------------ | ---------------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                          | `core:blank-merged` `core:config-fields` |
| 2   | `buildDataConfigMap`     | collection | `core:config-fields` `core:data-inspected` | `core:config-map`                        |
| 3   | `setDefaultValues`       | collection | `core:config-map`                          | —                                        |
| 4   | `validateFields`         | collection | `core:config-map`                          | `core:validated`                         |
| 5   | `anonymous`              | collection | `core:validated`                           | —                                        |

### afterCreate

| #   | hook        | from       | requires | provides |
| --- | ----------- | ---------- | -------- | -------- |
| 1   | `anonymous` | collection | —        | —        |

### beforeUpdate

| #   | hook                        | from       | requires                                   | provides                   |
| --- | --------------------------- | ---------- | ------------------------------------------ | -------------------------- |
| 1   | `getOriginalDocument`       | collection | —                                          | `core:original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `core:original-doc`                        | `core:original-config-map` |
| 3   | `resolveContentOwner`       | collection | `core:original-doc`                        | `core:content-owner`       |
| 4   | `buildDataConfigMap`        | collection | `core:config-fields` `core:data-inspected` | `core:config-map`          |
| 5   | `setDefaultValues`          | collection | `core:config-map`                          | —                          |
| 6   | `validateFields`            | collection | `core:config-map`                          | `core:validated`           |
| 7   | `anonymous`                 | collection | `core:validated`                           | —                          |

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

| #   | hook                    | from       | requires                      | provides                      |
| --- | ----------------------- | ---------- | ----------------------------- | ----------------------------- |
| 1   | `processDocumentFields` | collection | `core:sanitized`              | `core:shaped` `core:document` |
| 2   | `setDocumentLocale`     | collection | `core:shaped`                 | `core:document`               |
| 3   | `setDocumentType`       | collection | `core:shaped`                 | `core:document`               |
| 4   | `populateSizes`         | upload     | `core:shaped`                 | `core:document`               |
| 5   | `setDocumentTitle`      | title      | `core:shaped`                 | `core:title` `core:document`  |
| 6   | `setDocumentThumbnail`  | thumbnail  | `core:shaped` `core:document` | `core:document`               |
| 7   | `sortDocumentProps`     | collection | `core:document`               | —                             |

### beforeCreate

| #   | hook                     | from       | requires                                   | provides                                 |
| --- | ------------------------ | ---------- | ------------------------------------------ | ---------------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                          | `core:blank-merged` `core:config-fields` |
| 2   | `buildDataConfigMap`     | collection | `core:config-fields` `core:data-inspected` | `core:config-map`                        |
| 3   | `setDefaultValues`       | collection | `core:config-map`                          | —                                        |
| 4   | `validateFields`         | collection | `core:config-map`                          | `core:validated`                         |
| 5   | `handlePathCreation`     | upload     | `core:validated`                           | —                                        |
| 6   | `castBase64ToFile`       | upload     | `core:validated`                           | —                                        |
| 7   | `processFileUpload`      | upload     | `core:validated`                           | —                                        |

### beforeUpdate

| #   | hook                        | from       | requires                                   | provides                   |
| --- | --------------------------- | ---------- | ------------------------------------------ | -------------------------- |
| 1   | `getOriginalDocument`       | collection | —                                          | `core:original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `core:original-doc`                        | `core:original-config-map` |
| 3   | `resolveContentOwner`       | collection | `core:original-doc`                        | `core:content-owner`       |
| 4   | `buildDataConfigMap`        | collection | `core:config-fields` `core:data-inspected` | `core:config-map`          |
| 5   | `setDefaultValues`          | collection | `core:config-map`                          | —                          |
| 6   | `validateFields`            | collection | `core:config-map`                          | `core:validated`           |
| 7   | `handlePathCreation`        | upload     | `core:validated`                           | —                          |
| 8   | `castBase64ToFile`          | upload     | `core:validated`                           | —                          |
| 9   | `processFileUpload`         | upload     | `core:validated`                           | —                          |

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

| #   | hook                    | from       | requires                      | provides                      |
| --- | ----------------------- | ---------- | ----------------------------- | ----------------------------- |
| 1   | `processDocumentFields` | collection | `core:sanitized`              | `core:shaped` `core:document` |
| 2   | `setDocumentLocale`     | collection | `core:shaped`                 | `core:document`               |
| 3   | `setDocumentType`       | collection | `core:shaped`                 | `core:document`               |
| 4   | `setDocumentTitle`      | title      | `core:shaped`                 | `core:title` `core:document`  |
| 5   | `populateURL`           | url        | `core:shaped` `core:title`    | `core:document`               |
| 6   | `setDocumentThumbnail`  | thumbnail  | `core:shaped` `core:document` | `core:document`               |
| 7   | `sortDocumentProps`     | collection | `core:document`               | —                             |

### beforeCreate

| #   | hook                     | from       | requires                                   | provides                                 |
| --- | ------------------------ | ---------- | ------------------------------------------ | ---------------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                          | `core:blank-merged` `core:config-fields` |
| 2   | `buildDataConfigMap`     | collection | `core:config-fields` `core:data-inspected` | `core:config-map`                        |
| 3   | `setDefaultValues`       | collection | `core:config-map`                          | —                                        |
| 4   | `validateFields`         | collection | `core:config-map`                          | `core:validated`                         |

### beforeUpdate

| #   | hook                        | from       | requires                                   | provides                   |
| --- | --------------------------- | ---------- | ------------------------------------------ | -------------------------- |
| 1   | `getOriginalDocument`       | collection | —                                          | `core:original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `core:original-doc`                        | `core:original-config-map` |
| 3   | `resolveContentOwner`       | collection | `core:original-doc`                        | `core:content-owner`       |
| 4   | `buildDataConfigMap`        | collection | `core:config-fields` `core:data-inspected` | `core:config-map`          |
| 5   | `setDefaultValues`          | collection | `core:config-map`                          | —                          |
| 6   | `validateFields`            | collection | `core:config-map`                          | `core:validated`           |

## users (collection)

### beforeOperation

| #   | hook        | from       | requires | provides |
| --- | ----------- | ---------- | -------- | -------- |
| 1   | `authorize` | collection | —        | —        |

### beforeRead

| #   | hook                    | from       | requires                      | provides                      |
| --- | ----------------------- | ---------- | ----------------------------- | ----------------------------- |
| 1   | `removePrivateFields`   | auth       | —                             | `core:sanitized`              |
| 2   | `processDocumentFields` | collection | `core:sanitized`              | `core:shaped` `core:document` |
| 3   | `setDocumentLocale`     | collection | `core:shaped`                 | `core:document`               |
| 4   | `setDocumentType`       | collection | `core:shaped`                 | `core:document`               |
| 5   | `setDocumentTitle`      | title      | `core:shaped`                 | `core:title` `core:document`  |
| 6   | `setDocumentThumbnail`  | thumbnail  | `core:shaped` `core:document` | `core:document`               |
| 7   | `sortDocumentProps`     | collection | `core:document`               | —                             |

### beforeCreate

| #   | hook                     | from       | requires                                   | provides                                 |
| --- | ------------------------ | ---------- | ------------------------------------------ | ---------------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                          | `core:blank-merged` `core:config-fields` |
| 2   | `augmentFieldsPassword`  | auth       | `core:blank-merged`                        | `core:config-fields`                     |
| 3   | `buildDataConfigMap`     | collection | `core:config-fields` `core:data-inspected` | `core:config-map`                        |
| 4   | `setDefaultValues`       | collection | `core:config-map`                          | —                                        |
| 5   | `validateFields`         | collection | `core:config-map`                          | `core:validated`                         |
| 6   | `createBetterAuthUser`   | auth       | `core:validated`                           | —                                        |

### afterCreate

| #   | hook             | from | requires | provides |
| --- | ---------------- | ---- | -------- | -------- |
| 1   | `populateAPIKey` | auth | —        | —        |

### beforeUpdate

| #   | hook                        | from       | requires                                   | provides                   |
| --- | --------------------------- | ---------- | ------------------------------------------ | -------------------------- |
| 1   | `getOriginalDocument`       | collection | —                                          | `core:original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `core:original-doc`                        | `core:original-config-map` |
| 3   | `resolveContentOwner`       | collection | `core:original-doc`                        | `core:content-owner`       |
| 4   | `augmentFieldsPassword`     | auth       | `core:blank-merged`                        | `core:config-fields`       |
| 5   | `preventSuperAdminMutation` | auth       | `core:original-doc`                        | `core:data-inspected`      |
| 6   | `preventUserMutations`      | auth       | `core:original-doc`                        | `core:data-inspected`      |
| 7   | `forwardRolesToBetterAuth`  | auth       | `core:original-doc`                        | `core:data-inspected`      |
| 8   | `buildDataConfigMap`        | collection | `core:config-fields` `core:data-inspected` | `core:config-map`          |
| 9   | `setDefaultValues`          | collection | `core:config-map`                          | —                          |
| 10  | `validateFields`            | collection | `core:config-map`                          | `core:validated`           |

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

| #   | hook                    | from       | requires                      | provides                      |
| --- | ----------------------- | ---------- | ----------------------------- | ----------------------------- |
| 1   | `removePrivateFields`   | auth       | —                             | `core:sanitized`              |
| 2   | `processDocumentFields` | collection | `core:sanitized`              | `core:shaped` `core:document` |
| 3   | `setDocumentLocale`     | collection | `core:shaped`                 | `core:document`               |
| 4   | `setDocumentType`       | collection | `core:shaped`                 | `core:document`               |
| 5   | `setDocumentTitle`      | title      | `core:shaped`                 | `core:title` `core:document`  |
| 6   | `setDocumentThumbnail`  | thumbnail  | `core:shaped` `core:document` | `core:document`               |
| 7   | `sortDocumentProps`     | collection | `core:document`               | —                             |

### beforeCreate

| #   | hook                     | from       | requires                                   | provides                                 |
| --- | ------------------------ | ---------- | ------------------------------------------ | ---------------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                          | `core:blank-merged` `core:config-fields` |
| 2   | `augmentFieldsPassword`  | auth       | `core:blank-merged`                        | `core:config-fields`                     |
| 3   | `buildDataConfigMap`     | collection | `core:config-fields` `core:data-inspected` | `core:config-map`                        |
| 4   | `setDefaultValues`       | collection | `core:config-map`                          | —                                        |
| 5   | `validateFields`         | collection | `core:config-map`                          | `core:validated`                         |
| 6   | `createBetterAuthUser`   | auth       | `core:validated`                           | —                                        |

### afterCreate

| #   | hook             | from | requires | provides |
| --- | ---------------- | ---- | -------- | -------- |
| 1   | `populateAPIKey` | auth | —        | —        |

### beforeUpdate

| #   | hook                        | from       | requires                                   | provides                   |
| --- | --------------------------- | ---------- | ------------------------------------------ | -------------------------- |
| 1   | `getOriginalDocument`       | collection | —                                          | `core:original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `core:original-doc`                        | `core:original-config-map` |
| 3   | `resolveContentOwner`       | collection | `core:original-doc`                        | `core:content-owner`       |
| 4   | `augmentFieldsPassword`     | auth       | `core:blank-merged`                        | `core:config-fields`       |
| 5   | `preventSuperAdminMutation` | auth       | `core:original-doc`                        | `core:data-inspected`      |
| 6   | `preventUserMutations`      | auth       | `core:original-doc`                        | `core:data-inspected`      |
| 7   | `forwardRolesToBetterAuth`  | auth       | `core:original-doc`                        | `core:data-inspected`      |
| 8   | `buildDataConfigMap`        | collection | `core:config-fields` `core:data-inspected` | `core:config-map`          |
| 9   | `setDefaultValues`          | collection | `core:config-map`                          | —                          |
| 10  | `validateFields`            | collection | `core:config-map`                          | `core:validated`           |

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

| #   | hook                    | from       | requires                      | provides                      |
| --- | ----------------------- | ---------- | ----------------------------- | ----------------------------- |
| 1   | `removePrivateFields`   | auth       | —                             | `core:sanitized`              |
| 2   | `processDocumentFields` | collection | `core:sanitized`              | `core:shaped` `core:document` |
| 3   | `setDocumentLocale`     | collection | `core:shaped`                 | `core:document`               |
| 4   | `setDocumentType`       | collection | `core:shaped`                 | `core:document`               |
| 5   | `setDocumentTitle`      | title      | `core:shaped`                 | `core:title` `core:document`  |
| 6   | `setDocumentThumbnail`  | thumbnail  | `core:shaped` `core:document` | `core:document`               |
| 7   | `sortDocumentProps`     | collection | `core:document`               | —                             |

### beforeCreate

| #   | hook                     | from       | requires                                   | provides                                 |
| --- | ------------------------ | ---------- | ------------------------------------------ | ---------------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                          | `core:blank-merged` `core:config-fields` |
| 2   | `augmentFieldsPassword`  | auth       | `core:blank-merged`                        | `core:config-fields`                     |
| 3   | `buildDataConfigMap`     | collection | `core:config-fields` `core:data-inspected` | `core:config-map`                        |
| 4   | `setDefaultValues`       | collection | `core:config-map`                          | —                                        |
| 5   | `validateFields`         | collection | `core:config-map`                          | `core:validated`                         |
| 6   | `createBetterAuthUser`   | auth       | `core:validated`                           | —                                        |

### afterCreate

| #   | hook             | from | requires | provides |
| --- | ---------------- | ---- | -------- | -------- |
| 1   | `populateAPIKey` | auth | —        | —        |

### beforeUpdate

| #   | hook                        | from       | requires                                   | provides                   |
| --- | --------------------------- | ---------- | ------------------------------------------ | -------------------------- |
| 1   | `getOriginalDocument`       | collection | —                                          | `core:original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `core:original-doc`                        | `core:original-config-map` |
| 3   | `resolveContentOwner`       | collection | `core:original-doc`                        | `core:content-owner`       |
| 4   | `augmentFieldsPassword`     | auth       | `core:blank-merged`                        | `core:config-fields`       |
| 5   | `preventSuperAdminMutation` | auth       | `core:original-doc`                        | `core:data-inspected`      |
| 6   | `preventUserMutations`      | auth       | `core:original-doc`                        | `core:data-inspected`      |
| 7   | `forwardRolesToBetterAuth`  | auth       | `core:original-doc`                        | `core:data-inspected`      |
| 8   | `buildDataConfigMap`        | collection | `core:config-fields` `core:data-inspected` | `core:config-map`          |
| 9   | `setDefaultValues`          | collection | `core:config-map`                          | —                          |
| 10  | `validateFields`            | collection | `core:config-map`                          | `core:validated`           |

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

| #   | hook                    | from       | requires                      | provides                      |
| --- | ----------------------- | ---------- | ----------------------------- | ----------------------------- |
| 1   | `processDocumentFields` | collection | `core:sanitized`              | `core:shaped` `core:document` |
| 2   | `setDocumentLocale`     | collection | `core:shaped`                 | `core:document`               |
| 3   | `setDocumentType`       | collection | `core:shaped`                 | `core:document`               |
| 4   | `setDocumentTitle`      | title      | `core:shaped`                 | `core:title` `core:document`  |
| 5   | `setDocumentThumbnail`  | thumbnail  | `core:shaped` `core:document` | `core:document`               |
| 6   | `sortDocumentProps`     | collection | `core:document`               | —                             |

### beforeCreate

| #   | hook                     | from       | requires                                   | provides                                 |
| --- | ------------------------ | ---------- | ------------------------------------------ | ---------------------------------------- |
| 1   | `mergeWithBlankDocument` | collection | —                                          | `core:blank-merged` `core:config-fields` |
| 2   | `buildDataConfigMap`     | collection | `core:config-fields` `core:data-inspected` | `core:config-map`                        |
| 3   | `setDefaultValues`       | collection | `core:config-map`                          | —                                        |
| 4   | `validateFields`         | collection | `core:config-map`                          | `core:validated`                         |
| 5   | `exctractPath`           | collection | —                                          | —                                        |

### beforeUpdate

| #   | hook                        | from       | requires                                   | provides                   |
| --- | --------------------------- | ---------- | ------------------------------------------ | -------------------------- |
| 1   | `getOriginalDocument`       | collection | —                                          | `core:original-doc`        |
| 2   | `buildOriginalDocConfigMap` | collection | `core:original-doc`                        | `core:original-config-map` |
| 3   | `resolveContentOwner`       | collection | `core:original-doc`                        | `core:content-owner`       |
| 4   | `buildDataConfigMap`        | collection | `core:config-fields` `core:data-inspected` | `core:config-map`          |
| 5   | `setDefaultValues`          | collection | `core:config-map`                          | —                          |
| 6   | `validateFields`            | collection | `core:config-map`                          | `core:validated`           |
| 7   | `exctractPath`              | collection | —                                          | —                          |
| 8   | `prepareDirectoryChildren`  | collection | —                                          | —                          |

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

| #   | hook                    | from  | requires         | provides                      |
| --- | ----------------------- | ----- | ---------------- | ----------------------------- |
| 1   | `processDocumentFields` | area  | `core:sanitized` | `core:shaped` `core:document` |
| 2   | `setDocumentLocale`     | area  | `core:shaped`    | `core:document`               |
| 3   | `setDocumentType`       | area  | `core:shaped`    | `core:document`               |
| 4   | `setDocumentTitle`      | title | `core:shaped`    | `core:title` `core:document`  |
| 5   | `sortDocumentProps`     | area  | `core:document`  | —                             |

### beforeUpdate

| #   | hook                        | from | requires                                   | provides                   |
| --- | --------------------------- | ---- | ------------------------------------------ | -------------------------- |
| 1   | `getOriginalDocument`       | area | —                                          | `core:original-doc`        |
| 2   | `buildOriginalDocConfigMap` | area | `core:original-doc`                        | `core:original-config-map` |
| 3   | `resolveContentOwner`       | area | `core:original-doc`                        | `core:content-owner`       |
| 4   | `buildDataConfigMap`        | area | `core:config-fields` `core:data-inspected` | `core:config-map`          |
| 5   | `setDefaultValues`          | area | `core:config-map`                          | —                          |
| 6   | `validateFields`            | area | `core:config-map`                          | `core:validated`           |

## navigation (area)

### beforeOperation

| #   | hook        | from | requires | provides |
| --- | ----------- | ---- | -------- | -------- |
| 1   | `authorize` | area | —        | —        |

### beforeRead

| #   | hook                    | from  | requires         | provides                      |
| --- | ----------------------- | ----- | ---------------- | ----------------------------- |
| 1   | `processDocumentFields` | area  | `core:sanitized` | `core:shaped` `core:document` |
| 2   | `setDocumentLocale`     | area  | `core:shaped`    | `core:document`               |
| 3   | `setDocumentType`       | area  | `core:shaped`    | `core:document`               |
| 4   | `setDocumentTitle`      | title | `core:shaped`    | `core:title` `core:document`  |
| 5   | `sortDocumentProps`     | area  | `core:document`  | —                             |

### beforeUpdate

| #   | hook                        | from | requires                                   | provides                   |
| --- | --------------------------- | ---- | ------------------------------------------ | -------------------------- |
| 1   | `getOriginalDocument`       | area | —                                          | `core:original-doc`        |
| 2   | `buildOriginalDocConfigMap` | area | `core:original-doc`                        | `core:original-config-map` |
| 3   | `resolveContentOwner`       | area | `core:original-doc`                        | `core:content-owner`       |
| 4   | `buildDataConfigMap`        | area | `core:config-fields` `core:data-inspected` | `core:config-map`          |
| 5   | `setDefaultValues`          | area | `core:config-map`                          | —                          |
| 6   | `validateFields`            | area | `core:config-map`                          | `core:validated`           |

## infos (area)

### beforeOperation

| #   | hook        | from | requires | provides |
| --- | ----------- | ---- | -------- | -------- |
| 1   | `authorize` | area | —        | —        |

### beforeRead

| #   | hook                    | from  | requires         | provides                      |
| --- | ----------------------- | ----- | ---------------- | ----------------------------- |
| 1   | `processDocumentFields` | area  | `core:sanitized` | `core:shaped` `core:document` |
| 2   | `setDocumentLocale`     | area  | `core:shaped`    | `core:document`               |
| 3   | `setDocumentType`       | area  | `core:shaped`    | `core:document`               |
| 4   | `setDocumentTitle`      | title | `core:shaped`    | `core:title` `core:document`  |
| 5   | `sortDocumentProps`     | area  | `core:document`  | —                             |

### beforeUpdate

| #   | hook                        | from | requires                                   | provides                   |
| --- | --------------------------- | ---- | ------------------------------------------ | -------------------------- |
| 1   | `getOriginalDocument`       | area | —                                          | `core:original-doc`        |
| 2   | `buildOriginalDocConfigMap` | area | `core:original-doc`                        | `core:original-config-map` |
| 3   | `resolveContentOwner`       | area | `core:original-doc`                        | `core:content-owner`       |
| 4   | `buildDataConfigMap`        | area | `core:config-fields` `core:data-inspected` | `core:config-map`          |
| 5   | `setDefaultValues`          | area | `core:config-map`                          | —                          |
| 6   | `validateFields`            | area | `core:config-map`                          | `core:validated`           |
