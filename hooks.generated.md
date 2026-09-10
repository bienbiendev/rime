# Pipelines

One table per timing, in the order the hooks actually run.

**The order itself is written down**, in each prototype's `hooks.server.ts`. What this adds
is the one thing that file cannot show: which of those hooks **this** config runs, after
`buildPipeline` filters out the features it does not enable.

`from` is the prototype, or the feature that owns the hook. `anonymous` is a hook your
config contributed without naming it — every rime-owned hook is named, and a consumer's are
appended after the prototype's, before the finaliser.

## pages (collection)

### beforeOperation

| #   | hook        | from       |
| --- | ----------- | ---------- |
| 1   | `authorize` | collection |

### beforeRead

| #   | hook                    | from       |
| --- | ----------------------- | ---------- |
| 1   | `processDocumentFields` | collection |
| 2   | `setDocumentLocale`     | collection |
| 3   | `setDocumentType`       | collection |
| 4   | `addChildrenProperty`   | nested     |
| 5   | `setDocumentTitle`      | title      |
| 6   | `populateURL`           | url        |
| 7   | `setDocumentThumbnail`  | thumbnail  |
| 8   | `anonymous`             | collection |
| 9   | `sortDocumentProps`     | collection |

### beforeCreate

| #   | hook                     | from       |
| --- | ------------------------ | ---------- |
| 1   | `mergeWithBlankDocument` | collection |
| 2   | `buildDataConfigMap`     | collection |
| 3   | `setDefaultValues`       | collection |
| 4   | `validateFields`         | collection |
| 5   | `anonymous`              | collection |

### afterCreate

| #   | hook        | from       |
| --- | ----------- | ---------- |
| 1   | `anonymous` | collection |

### beforeUpdate

| #   | hook                        | from       |
| --- | --------------------------- | ---------- |
| 1   | `getOriginalDocument`       | collection |
| 2   | `buildOriginalDocConfigMap` | collection |
| 3   | `resolveContentOwner`       | collection |
| 4   | `buildDataConfigMap`        | collection |
| 5   | `setDefaultValues`          | collection |
| 6   | `validateFields`            | collection |
| 7   | `anonymous`                 | collection |

### afterUpdate

| #   | hook        | from       |
| --- | ----------- | ---------- |
| 1   | `anonymous` | collection |

## medias (collection)

### beforeOperation

| #   | hook        | from       |
| --- | ----------- | ---------- |
| 1   | `authorize` | collection |

### beforeRead

| #   | hook                    | from       |
| --- | ----------------------- | ---------- |
| 1   | `processDocumentFields` | collection |
| 2   | `setDocumentLocale`     | collection |
| 3   | `setDocumentType`       | collection |
| 4   | `populateSizes`         | upload     |
| 5   | `setDocumentTitle`      | title      |
| 6   | `setDocumentThumbnail`  | thumbnail  |
| 7   | `sortDocumentProps`     | collection |

### beforeCreate

| #   | hook                     | from       |
| --- | ------------------------ | ---------- |
| 1   | `mergeWithBlankDocument` | collection |
| 2   | `buildDataConfigMap`     | collection |
| 3   | `setDefaultValues`       | collection |
| 4   | `validateFields`         | collection |
| 5   | `handlePathCreation`     | upload     |
| 6   | `castBase64ToFile`       | upload     |
| 7   | `processFileUpload`      | upload     |

### beforeUpdate

| #   | hook                        | from       |
| --- | --------------------------- | ---------- |
| 1   | `getOriginalDocument`       | collection |
| 2   | `buildOriginalDocConfigMap` | collection |
| 3   | `resolveContentOwner`       | collection |
| 4   | `buildDataConfigMap`        | collection |
| 5   | `setDefaultValues`          | collection |
| 6   | `validateFields`            | collection |
| 7   | `handlePathCreation`        | upload     |
| 8   | `castBase64ToFile`          | upload     |
| 9   | `processFileUpload`         | upload     |

### beforeDelete

| #   | hook           | from   |
| --- | -------------- | ------ |
| 1   | `cleanUpFiles` | upload |

## news (collection)

### beforeOperation

| #   | hook        | from       |
| --- | ----------- | ---------- |
| 1   | `authorize` | collection |

### beforeRead

| #   | hook                    | from       |
| --- | ----------------------- | ---------- |
| 1   | `processDocumentFields` | collection |
| 2   | `setDocumentLocale`     | collection |
| 3   | `setDocumentType`       | collection |
| 4   | `setDocumentTitle`      | title      |
| 5   | `populateURL`           | url        |
| 6   | `setDocumentThumbnail`  | thumbnail  |
| 7   | `sortDocumentProps`     | collection |

### beforeCreate

| #   | hook                     | from       |
| --- | ------------------------ | ---------- |
| 1   | `mergeWithBlankDocument` | collection |
| 2   | `buildDataConfigMap`     | collection |
| 3   | `setDefaultValues`       | collection |
| 4   | `validateFields`         | collection |

### beforeUpdate

| #   | hook                        | from       |
| --- | --------------------------- | ---------- |
| 1   | `getOriginalDocument`       | collection |
| 2   | `buildOriginalDocConfigMap` | collection |
| 3   | `resolveContentOwner`       | collection |
| 4   | `buildDataConfigMap`        | collection |
| 5   | `setDefaultValues`          | collection |
| 6   | `validateFields`            | collection |

## users (collection)

### beforeOperation

| #   | hook        | from       |
| --- | ----------- | ---------- |
| 1   | `authorize` | collection |

### beforeRead

| #   | hook                    | from       |
| --- | ----------------------- | ---------- |
| 1   | `removePrivateFields`   | auth       |
| 2   | `processDocumentFields` | collection |
| 3   | `setDocumentLocale`     | collection |
| 4   | `setDocumentType`       | collection |
| 5   | `setDocumentTitle`      | title      |
| 6   | `setDocumentThumbnail`  | thumbnail  |
| 7   | `sortDocumentProps`     | collection |

### beforeCreate

| #   | hook                     | from       |
| --- | ------------------------ | ---------- |
| 1   | `mergeWithBlankDocument` | collection |
| 2   | `augmentFieldsPassword`  | auth       |
| 3   | `buildDataConfigMap`     | collection |
| 4   | `setDefaultValues`       | collection |
| 5   | `validateFields`         | collection |
| 6   | `createBetterAuthUser`   | auth       |

### afterCreate

| #   | hook             | from |
| --- | ---------------- | ---- |
| 1   | `populateAPIKey` | auth |
| 2   | `signInNewUser`  | auth |

### beforeUpdate

| #   | hook                        | from       |
| --- | --------------------------- | ---------- |
| 1   | `getOriginalDocument`       | collection |
| 2   | `buildOriginalDocConfigMap` | collection |
| 3   | `resolveContentOwner`       | collection |
| 4   | `augmentFieldsPassword`     | auth       |
| 5   | `preventSuperAdminMutation` | auth       |
| 6   | `preventUserMutations`      | auth       |
| 7   | `forwardRolesToBetterAuth`  | auth       |
| 8   | `buildDataConfigMap`        | collection |
| 9   | `setDefaultValues`          | collection |
| 10  | `validateFields`            | collection |

### beforeDelete

| #   | hook                         | from |
| --- | ---------------------------- | ---- |
| 1   | `preventSupperAdminDeletion` | auth |

### afterDelete

| #   | hook                   | from |
| --- | ---------------------- | ---- |
| 1   | `deleteBetterAuthUser` | auth |

## apps (collection)

### beforeOperation

| #   | hook        | from       |
| --- | ----------- | ---------- |
| 1   | `authorize` | collection |

### beforeRead

| #   | hook                    | from       |
| --- | ----------------------- | ---------- |
| 1   | `removePrivateFields`   | auth       |
| 2   | `processDocumentFields` | collection |
| 3   | `setDocumentLocale`     | collection |
| 4   | `setDocumentType`       | collection |
| 5   | `setDocumentTitle`      | title      |
| 6   | `setDocumentThumbnail`  | thumbnail  |
| 7   | `sortDocumentProps`     | collection |

### beforeCreate

| #   | hook                     | from       |
| --- | ------------------------ | ---------- |
| 1   | `mergeWithBlankDocument` | collection |
| 2   | `augmentFieldsPassword`  | auth       |
| 3   | `buildDataConfigMap`     | collection |
| 4   | `setDefaultValues`       | collection |
| 5   | `validateFields`         | collection |
| 6   | `createBetterAuthUser`   | auth       |

### afterCreate

| #   | hook             | from |
| --- | ---------------- | ---- |
| 1   | `populateAPIKey` | auth |
| 2   | `signInNewUser`  | auth |

### beforeUpdate

| #   | hook                        | from       |
| --- | --------------------------- | ---------- |
| 1   | `getOriginalDocument`       | collection |
| 2   | `buildOriginalDocConfigMap` | collection |
| 3   | `resolveContentOwner`       | collection |
| 4   | `augmentFieldsPassword`     | auth       |
| 5   | `preventSuperAdminMutation` | auth       |
| 6   | `preventUserMutations`      | auth       |
| 7   | `forwardRolesToBetterAuth`  | auth       |
| 8   | `buildDataConfigMap`        | collection |
| 9   | `setDefaultValues`          | collection |
| 10  | `validateFields`            | collection |

### beforeDelete

| #   | hook                         | from |
| --- | ---------------------------- | ---- |
| 1   | `preventSupperAdminDeletion` | auth |

### afterDelete

| #   | hook                   | from |
| --- | ---------------------- | ---- |
| 1   | `deleteBetterAuthUser` | auth |

## staff (collection)

### beforeOperation

| #   | hook        | from       |
| --- | ----------- | ---------- |
| 1   | `authorize` | collection |

### beforeRead

| #   | hook                    | from       |
| --- | ----------------------- | ---------- |
| 1   | `removePrivateFields`   | auth       |
| 2   | `processDocumentFields` | collection |
| 3   | `setDocumentLocale`     | collection |
| 4   | `setDocumentType`       | collection |
| 5   | `setDocumentTitle`      | title      |
| 6   | `setDocumentThumbnail`  | thumbnail  |
| 7   | `sortDocumentProps`     | collection |

### beforeCreate

| #   | hook                     | from       |
| --- | ------------------------ | ---------- |
| 1   | `mergeWithBlankDocument` | collection |
| 2   | `augmentFieldsPassword`  | auth       |
| 3   | `buildDataConfigMap`     | collection |
| 4   | `setDefaultValues`       | collection |
| 5   | `validateFields`         | collection |
| 6   | `createBetterAuthUser`   | auth       |

### afterCreate

| #   | hook             | from |
| --- | ---------------- | ---- |
| 1   | `populateAPIKey` | auth |
| 2   | `signInNewUser`  | auth |

### beforeUpdate

| #   | hook                        | from       |
| --- | --------------------------- | ---------- |
| 1   | `getOriginalDocument`       | collection |
| 2   | `buildOriginalDocConfigMap` | collection |
| 3   | `resolveContentOwner`       | collection |
| 4   | `augmentFieldsPassword`     | auth       |
| 5   | `preventSuperAdminMutation` | auth       |
| 6   | `preventUserMutations`      | auth       |
| 7   | `forwardRolesToBetterAuth`  | auth       |
| 8   | `buildDataConfigMap`        | collection |
| 9   | `setDefaultValues`          | collection |
| 10  | `validateFields`            | collection |

### beforeDelete

| #   | hook                         | from |
| --- | ---------------------------- | ---- |
| 1   | `preventSupperAdminDeletion` | auth |

### afterDelete

| #   | hook                   | from |
| --- | ---------------------- | ---- |
| 1   | `deleteBetterAuthUser` | auth |

## $mediasDirectories (collection)

### beforeOperation

| #   | hook        | from       |
| --- | ----------- | ---------- |
| 1   | `authorize` | collection |

### beforeRead

| #   | hook                    | from       |
| --- | ----------------------- | ---------- |
| 1   | `processDocumentFields` | collection |
| 2   | `setDocumentLocale`     | collection |
| 3   | `setDocumentType`       | collection |
| 4   | `setDocumentTitle`      | title      |
| 5   | `setDocumentThumbnail`  | thumbnail  |
| 6   | `sortDocumentProps`     | collection |

### beforeCreate

| #   | hook                     | from       |
| --- | ------------------------ | ---------- |
| 1   | `mergeWithBlankDocument` | collection |
| 2   | `buildDataConfigMap`     | collection |
| 3   | `setDefaultValues`       | collection |
| 4   | `validateFields`         | collection |
| 5   | `exctractPath`           | upload     |

### beforeUpdate

| #   | hook                        | from       |
| --- | --------------------------- | ---------- |
| 1   | `getOriginalDocument`       | collection |
| 2   | `buildOriginalDocConfigMap` | collection |
| 3   | `resolveContentOwner`       | collection |
| 4   | `buildDataConfigMap`        | collection |
| 5   | `setDefaultValues`          | collection |
| 6   | `validateFields`            | collection |
| 7   | `exctractPath`              | upload     |
| 8   | `prepareDirectoryChildren`  | upload     |

### afterUpdate

| #   | hook                      | from       |
| --- | ------------------------- | ---------- |
| 1   | `updateDirectoryChildren` | collection |

## settings (area)

### beforeOperation

| #   | hook        | from |
| --- | ----------- | ---- |
| 1   | `authorize` | area |

### beforeRead

| #   | hook                    | from  |
| --- | ----------------------- | ----- |
| 1   | `processDocumentFields` | area  |
| 2   | `setDocumentLocale`     | area  |
| 3   | `setDocumentType`       | area  |
| 4   | `setDocumentTitle`      | title |
| 5   | `sortDocumentProps`     | area  |

### beforeUpdate

| #   | hook                        | from |
| --- | --------------------------- | ---- |
| 1   | `getOriginalDocument`       | area |
| 2   | `buildOriginalDocConfigMap` | area |
| 3   | `resolveContentOwner`       | area |
| 4   | `buildDataConfigMap`        | area |
| 5   | `setDefaultValues`          | area |
| 6   | `validateFields`            | area |

## navigation (area)

### beforeOperation

| #   | hook        | from |
| --- | ----------- | ---- |
| 1   | `authorize` | area |

### beforeRead

| #   | hook                    | from  |
| --- | ----------------------- | ----- |
| 1   | `processDocumentFields` | area  |
| 2   | `setDocumentLocale`     | area  |
| 3   | `setDocumentType`       | area  |
| 4   | `setDocumentTitle`      | title |
| 5   | `sortDocumentProps`     | area  |

### beforeUpdate

| #   | hook                        | from |
| --- | --------------------------- | ---- |
| 1   | `getOriginalDocument`       | area |
| 2   | `buildOriginalDocConfigMap` | area |
| 3   | `resolveContentOwner`       | area |
| 4   | `buildDataConfigMap`        | area |
| 5   | `setDefaultValues`          | area |
| 6   | `validateFields`            | area |

## infos (area)

### beforeOperation

| #   | hook        | from |
| --- | ----------- | ---- |
| 1   | `authorize` | area |

### beforeRead

| #   | hook                    | from  |
| --- | ----------------------- | ----- |
| 1   | `processDocumentFields` | area  |
| 2   | `setDocumentLocale`     | area  |
| 3   | `setDocumentType`       | area  |
| 4   | `setDocumentTitle`      | title |
| 5   | `sortDocumentProps`     | area  |

### beforeUpdate

| #   | hook                        | from |
| --- | --------------------------- | ---- |
| 1   | `getOriginalDocument`       | area |
| 2   | `buildOriginalDocConfigMap` | area |
| 3   | `resolveContentOwner`       | area |
| 4   | `buildDataConfigMap`        | area |
| 5   | `setDefaultValues`          | area |
| 6   | `validateFields`            | area |
