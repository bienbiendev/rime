# Pipelines

One table per timing, in the order the hooks actually run.

**The order is written down**, in each prototype's `hooks.server.ts`. What this adds is what
that file cannot show: your own hooks, appended after the prototype's and before the
finaliser, and the hooks of any collection a feature derived.

Every hook a prototype places is listed, whether or not it applies here: a hook belonging to
a feature is written `when(isAuth, …)` in that list and asks at the call. `anonymous` is a
hook you contributed without naming it — every rime-owned hook is a named function.

## pages (collection)

### beforeOperation

| #   | hook        |
| --- | ----------- |
| 1   | `authorize` |

### beforeRead

| #   | hook                    |
| --- | ----------------------- |
| 1   | `removePrivateFields`   |
| 2   | `processDocumentFields` |
| 3   | `setDocumentLocale`     |
| 4   | `setDocumentType`       |
| 5   | `populateSizes`         |
| 6   | `addChildrenProperty`   |
| 7   | `exposeVersionId`       |
| 8   | `setDocumentTitle`      |
| 9   | `populateURL`           |
| 10  | `setDocumentThumbnail`  |
| 11  | `anonymous`             |
| 12  | `sortDocumentProps`     |

### beforeCreate

| #   | hook                     |
| --- | ------------------------ |
| 1   | `mergeWithBlankDocument` |
| 2   | `augmentFieldsPassword`  |
| 3   | `buildDataConfigMap`     |
| 4   | `setDefaultValues`       |
| 5   | `validateFields`         |
| 6   | `createBetterAuthUser`   |
| 7   | `handlePathCreation`     |
| 8   | `castBase64ToFile`       |
| 9   | `processFileUpload`      |
| 10  | `anonymous`              |

### afterCreate

| #   | hook             |
| --- | ---------------- |
| 1   | `populateAPIKey` |
| 2   | `signInNewUser`  |
| 3   | `anonymous`      |

### beforeUpdate

| #   | hook                        |
| --- | --------------------------- |
| 1   | `getOriginalDocument`       |
| 2   | `buildOriginalDocConfigMap` |
| 3   | `resolveContentOwner`       |
| 4   | `augmentFieldsPassword`     |
| 5   | `preventSuperAdminMutation` |
| 6   | `preventUserMutations`      |
| 7   | `forwardRolesToBetterAuth`  |
| 8   | `defineVersionOperation`    |
| 9   | `handleNewVersion`          |
| 10  | `buildDataConfigMap`        |
| 11  | `setDefaultValues`          |
| 12  | `validateFields`            |
| 13  | `handlePathCreation`        |
| 14  | `castBase64ToFile`          |
| 15  | `processFileUpload`         |
| 16  | `demoteOtherVersions`       |
| 17  | `anonymous`                 |

### afterUpdate

| #   | hook        |
| --- | ----------- |
| 1   | `anonymous` |

### beforeDelete

| #   | hook                         |
| --- | ---------------------------- |
| 1   | `preventSupperAdminDeletion` |
| 2   | `cleanUpFiles`               |

### afterDelete

| #   | hook                   |
| --- | ---------------------- |
| 1   | `deleteBetterAuthUser` |

## medias (collection)

### beforeOperation

| #   | hook        |
| --- | ----------- |
| 1   | `authorize` |

### beforeRead

| #   | hook                    |
| --- | ----------------------- |
| 1   | `removePrivateFields`   |
| 2   | `processDocumentFields` |
| 3   | `setDocumentLocale`     |
| 4   | `setDocumentType`       |
| 5   | `populateSizes`         |
| 6   | `addChildrenProperty`   |
| 7   | `exposeVersionId`       |
| 8   | `setDocumentTitle`      |
| 9   | `populateURL`           |
| 10  | `setDocumentThumbnail`  |
| 11  | `sortDocumentProps`     |

### beforeCreate

| #   | hook                     |
| --- | ------------------------ |
| 1   | `mergeWithBlankDocument` |
| 2   | `augmentFieldsPassword`  |
| 3   | `buildDataConfigMap`     |
| 4   | `setDefaultValues`       |
| 5   | `validateFields`         |
| 6   | `createBetterAuthUser`   |
| 7   | `handlePathCreation`     |
| 8   | `castBase64ToFile`       |
| 9   | `processFileUpload`      |

### afterCreate

| #   | hook             |
| --- | ---------------- |
| 1   | `populateAPIKey` |
| 2   | `signInNewUser`  |

### beforeUpdate

| #   | hook                        |
| --- | --------------------------- |
| 1   | `getOriginalDocument`       |
| 2   | `buildOriginalDocConfigMap` |
| 3   | `resolveContentOwner`       |
| 4   | `augmentFieldsPassword`     |
| 5   | `preventSuperAdminMutation` |
| 6   | `preventUserMutations`      |
| 7   | `forwardRolesToBetterAuth`  |
| 8   | `defineVersionOperation`    |
| 9   | `handleNewVersion`          |
| 10  | `buildDataConfigMap`        |
| 11  | `setDefaultValues`          |
| 12  | `validateFields`            |
| 13  | `handlePathCreation`        |
| 14  | `castBase64ToFile`          |
| 15  | `processFileUpload`         |
| 16  | `demoteOtherVersions`       |

### beforeDelete

| #   | hook                         |
| --- | ---------------------------- |
| 1   | `preventSupperAdminDeletion` |
| 2   | `cleanUpFiles`               |

### afterDelete

| #   | hook                   |
| --- | ---------------------- |
| 1   | `deleteBetterAuthUser` |

## news (collection)

### beforeOperation

| #   | hook        |
| --- | ----------- |
| 1   | `authorize` |

### beforeRead

| #   | hook                    |
| --- | ----------------------- |
| 1   | `removePrivateFields`   |
| 2   | `processDocumentFields` |
| 3   | `setDocumentLocale`     |
| 4   | `setDocumentType`       |
| 5   | `populateSizes`         |
| 6   | `addChildrenProperty`   |
| 7   | `exposeVersionId`       |
| 8   | `setDocumentTitle`      |
| 9   | `populateURL`           |
| 10  | `setDocumentThumbnail`  |
| 11  | `sortDocumentProps`     |

### beforeCreate

| #   | hook                     |
| --- | ------------------------ |
| 1   | `mergeWithBlankDocument` |
| 2   | `augmentFieldsPassword`  |
| 3   | `buildDataConfigMap`     |
| 4   | `setDefaultValues`       |
| 5   | `validateFields`         |
| 6   | `createBetterAuthUser`   |
| 7   | `handlePathCreation`     |
| 8   | `castBase64ToFile`       |
| 9   | `processFileUpload`      |

### afterCreate

| #   | hook             |
| --- | ---------------- |
| 1   | `populateAPIKey` |
| 2   | `signInNewUser`  |

### beforeUpdate

| #   | hook                        |
| --- | --------------------------- |
| 1   | `getOriginalDocument`       |
| 2   | `buildOriginalDocConfigMap` |
| 3   | `resolveContentOwner`       |
| 4   | `augmentFieldsPassword`     |
| 5   | `preventSuperAdminMutation` |
| 6   | `preventUserMutations`      |
| 7   | `forwardRolesToBetterAuth`  |
| 8   | `defineVersionOperation`    |
| 9   | `handleNewVersion`          |
| 10  | `buildDataConfigMap`        |
| 11  | `setDefaultValues`          |
| 12  | `validateFields`            |
| 13  | `handlePathCreation`        |
| 14  | `castBase64ToFile`          |
| 15  | `processFileUpload`         |
| 16  | `demoteOtherVersions`       |

### beforeDelete

| #   | hook                         |
| --- | ---------------------------- |
| 1   | `preventSupperAdminDeletion` |
| 2   | `cleanUpFiles`               |

### afterDelete

| #   | hook                   |
| --- | ---------------------- |
| 1   | `deleteBetterAuthUser` |

## users (collection)

### beforeOperation

| #   | hook        |
| --- | ----------- |
| 1   | `authorize` |

### beforeRead

| #   | hook                    |
| --- | ----------------------- |
| 1   | `removePrivateFields`   |
| 2   | `processDocumentFields` |
| 3   | `setDocumentLocale`     |
| 4   | `setDocumentType`       |
| 5   | `populateSizes`         |
| 6   | `addChildrenProperty`   |
| 7   | `exposeVersionId`       |
| 8   | `setDocumentTitle`      |
| 9   | `populateURL`           |
| 10  | `setDocumentThumbnail`  |
| 11  | `sortDocumentProps`     |

### beforeCreate

| #   | hook                     |
| --- | ------------------------ |
| 1   | `mergeWithBlankDocument` |
| 2   | `augmentFieldsPassword`  |
| 3   | `buildDataConfigMap`     |
| 4   | `setDefaultValues`       |
| 5   | `validateFields`         |
| 6   | `createBetterAuthUser`   |
| 7   | `handlePathCreation`     |
| 8   | `castBase64ToFile`       |
| 9   | `processFileUpload`      |

### afterCreate

| #   | hook             |
| --- | ---------------- |
| 1   | `populateAPIKey` |
| 2   | `signInNewUser`  |

### beforeUpdate

| #   | hook                        |
| --- | --------------------------- |
| 1   | `getOriginalDocument`       |
| 2   | `buildOriginalDocConfigMap` |
| 3   | `resolveContentOwner`       |
| 4   | `augmentFieldsPassword`     |
| 5   | `preventSuperAdminMutation` |
| 6   | `preventUserMutations`      |
| 7   | `forwardRolesToBetterAuth`  |
| 8   | `defineVersionOperation`    |
| 9   | `handleNewVersion`          |
| 10  | `buildDataConfigMap`        |
| 11  | `setDefaultValues`          |
| 12  | `validateFields`            |
| 13  | `handlePathCreation`        |
| 14  | `castBase64ToFile`          |
| 15  | `processFileUpload`         |
| 16  | `demoteOtherVersions`       |

### beforeDelete

| #   | hook                         |
| --- | ---------------------------- |
| 1   | `preventSupperAdminDeletion` |
| 2   | `cleanUpFiles`               |

### afterDelete

| #   | hook                   |
| --- | ---------------------- |
| 1   | `deleteBetterAuthUser` |

## apps (collection)

### beforeOperation

| #   | hook        |
| --- | ----------- |
| 1   | `authorize` |

### beforeRead

| #   | hook                    |
| --- | ----------------------- |
| 1   | `removePrivateFields`   |
| 2   | `processDocumentFields` |
| 3   | `setDocumentLocale`     |
| 4   | `setDocumentType`       |
| 5   | `populateSizes`         |
| 6   | `addChildrenProperty`   |
| 7   | `exposeVersionId`       |
| 8   | `setDocumentTitle`      |
| 9   | `populateURL`           |
| 10  | `setDocumentThumbnail`  |
| 11  | `sortDocumentProps`     |

### beforeCreate

| #   | hook                     |
| --- | ------------------------ |
| 1   | `mergeWithBlankDocument` |
| 2   | `augmentFieldsPassword`  |
| 3   | `buildDataConfigMap`     |
| 4   | `setDefaultValues`       |
| 5   | `validateFields`         |
| 6   | `createBetterAuthUser`   |
| 7   | `handlePathCreation`     |
| 8   | `castBase64ToFile`       |
| 9   | `processFileUpload`      |

### afterCreate

| #   | hook             |
| --- | ---------------- |
| 1   | `populateAPIKey` |
| 2   | `signInNewUser`  |

### beforeUpdate

| #   | hook                        |
| --- | --------------------------- |
| 1   | `getOriginalDocument`       |
| 2   | `buildOriginalDocConfigMap` |
| 3   | `resolveContentOwner`       |
| 4   | `augmentFieldsPassword`     |
| 5   | `preventSuperAdminMutation` |
| 6   | `preventUserMutations`      |
| 7   | `forwardRolesToBetterAuth`  |
| 8   | `defineVersionOperation`    |
| 9   | `handleNewVersion`          |
| 10  | `buildDataConfigMap`        |
| 11  | `setDefaultValues`          |
| 12  | `validateFields`            |
| 13  | `handlePathCreation`        |
| 14  | `castBase64ToFile`          |
| 15  | `processFileUpload`         |
| 16  | `demoteOtherVersions`       |

### beforeDelete

| #   | hook                         |
| --- | ---------------------------- |
| 1   | `preventSupperAdminDeletion` |
| 2   | `cleanUpFiles`               |

### afterDelete

| #   | hook                   |
| --- | ---------------------- |
| 1   | `deleteBetterAuthUser` |

## staff (collection)

### beforeOperation

| #   | hook        |
| --- | ----------- |
| 1   | `authorize` |

### beforeRead

| #   | hook                    |
| --- | ----------------------- |
| 1   | `removePrivateFields`   |
| 2   | `processDocumentFields` |
| 3   | `setDocumentLocale`     |
| 4   | `setDocumentType`       |
| 5   | `populateSizes`         |
| 6   | `addChildrenProperty`   |
| 7   | `exposeVersionId`       |
| 8   | `setDocumentTitle`      |
| 9   | `populateURL`           |
| 10  | `setDocumentThumbnail`  |
| 11  | `sortDocumentProps`     |

### beforeCreate

| #   | hook                     |
| --- | ------------------------ |
| 1   | `mergeWithBlankDocument` |
| 2   | `augmentFieldsPassword`  |
| 3   | `buildDataConfigMap`     |
| 4   | `setDefaultValues`       |
| 5   | `validateFields`         |
| 6   | `createBetterAuthUser`   |
| 7   | `handlePathCreation`     |
| 8   | `castBase64ToFile`       |
| 9   | `processFileUpload`      |

### afterCreate

| #   | hook             |
| --- | ---------------- |
| 1   | `populateAPIKey` |
| 2   | `signInNewUser`  |

### beforeUpdate

| #   | hook                        |
| --- | --------------------------- |
| 1   | `getOriginalDocument`       |
| 2   | `buildOriginalDocConfigMap` |
| 3   | `resolveContentOwner`       |
| 4   | `augmentFieldsPassword`     |
| 5   | `preventSuperAdminMutation` |
| 6   | `preventUserMutations`      |
| 7   | `forwardRolesToBetterAuth`  |
| 8   | `defineVersionOperation`    |
| 9   | `handleNewVersion`          |
| 10  | `buildDataConfigMap`        |
| 11  | `setDefaultValues`          |
| 12  | `validateFields`            |
| 13  | `handlePathCreation`        |
| 14  | `castBase64ToFile`          |
| 15  | `processFileUpload`         |
| 16  | `demoteOtherVersions`       |

### beforeDelete

| #   | hook                         |
| --- | ---------------------------- |
| 1   | `preventSupperAdminDeletion` |
| 2   | `cleanUpFiles`               |

### afterDelete

| #   | hook                   |
| --- | ---------------------- |
| 1   | `deleteBetterAuthUser` |

## $mediasDirectories (collection)

### beforeOperation

| #   | hook        |
| --- | ----------- |
| 1   | `authorize` |

### beforeRead

| #   | hook                    |
| --- | ----------------------- |
| 1   | `removePrivateFields`   |
| 2   | `processDocumentFields` |
| 3   | `setDocumentLocale`     |
| 4   | `setDocumentType`       |
| 5   | `populateSizes`         |
| 6   | `addChildrenProperty`   |
| 7   | `exposeVersionId`       |
| 8   | `setDocumentTitle`      |
| 9   | `populateURL`           |
| 10  | `setDocumentThumbnail`  |
| 11  | `sortDocumentProps`     |

### beforeCreate

| #   | hook                     |
| --- | ------------------------ |
| 1   | `mergeWithBlankDocument` |
| 2   | `augmentFieldsPassword`  |
| 3   | `buildDataConfigMap`     |
| 4   | `setDefaultValues`       |
| 5   | `validateFields`         |
| 6   | `createBetterAuthUser`   |
| 7   | `handlePathCreation`     |
| 8   | `castBase64ToFile`       |
| 9   | `processFileUpload`      |
| 10  | `exctractPath`           |

### afterCreate

| #   | hook             |
| --- | ---------------- |
| 1   | `populateAPIKey` |
| 2   | `signInNewUser`  |

### beforeUpdate

| #   | hook                        |
| --- | --------------------------- |
| 1   | `getOriginalDocument`       |
| 2   | `buildOriginalDocConfigMap` |
| 3   | `resolveContentOwner`       |
| 4   | `augmentFieldsPassword`     |
| 5   | `preventSuperAdminMutation` |
| 6   | `preventUserMutations`      |
| 7   | `forwardRolesToBetterAuth`  |
| 8   | `defineVersionOperation`    |
| 9   | `handleNewVersion`          |
| 10  | `buildDataConfigMap`        |
| 11  | `setDefaultValues`          |
| 12  | `validateFields`            |
| 13  | `handlePathCreation`        |
| 14  | `castBase64ToFile`          |
| 15  | `processFileUpload`         |
| 16  | `demoteOtherVersions`       |
| 17  | `exctractPath`              |
| 18  | `prepareDirectoryChildren`  |

### afterUpdate

| #   | hook                      |
| --- | ------------------------- |
| 1   | `updateDirectoryChildren` |

### beforeDelete

| #   | hook                         |
| --- | ---------------------------- |
| 1   | `preventSupperAdminDeletion` |
| 2   | `cleanUpFiles`               |

### afterDelete

| #   | hook                   |
| --- | ---------------------- |
| 1   | `deleteBetterAuthUser` |

## settings (area)

### beforeOperation

| #   | hook        |
| --- | ----------- |
| 1   | `authorize` |

### beforeRead

| #   | hook                    |
| --- | ----------------------- |
| 1   | `processDocumentFields` |
| 2   | `setDocumentLocale`     |
| 3   | `setDocumentType`       |
| 4   | `exposeVersionId`       |
| 5   | `setDocumentTitle`      |
| 6   | `populateURL`           |
| 7   | `sortDocumentProps`     |

### beforeUpdate

| #   | hook                        |
| --- | --------------------------- |
| 1   | `getOriginalDocument`       |
| 2   | `buildOriginalDocConfigMap` |
| 3   | `resolveContentOwner`       |
| 4   | `defineVersionOperation`    |
| 5   | `handleNewVersion`          |
| 6   | `buildDataConfigMap`        |
| 7   | `setDefaultValues`          |
| 8   | `validateFields`            |
| 9   | `demoteOtherVersions`       |

## navigation (area)

### beforeOperation

| #   | hook        |
| --- | ----------- |
| 1   | `authorize` |

### beforeRead

| #   | hook                    |
| --- | ----------------------- |
| 1   | `processDocumentFields` |
| 2   | `setDocumentLocale`     |
| 3   | `setDocumentType`       |
| 4   | `exposeVersionId`       |
| 5   | `setDocumentTitle`      |
| 6   | `populateURL`           |
| 7   | `sortDocumentProps`     |

### beforeUpdate

| #   | hook                        |
| --- | --------------------------- |
| 1   | `getOriginalDocument`       |
| 2   | `buildOriginalDocConfigMap` |
| 3   | `resolveContentOwner`       |
| 4   | `defineVersionOperation`    |
| 5   | `handleNewVersion`          |
| 6   | `buildDataConfigMap`        |
| 7   | `setDefaultValues`          |
| 8   | `validateFields`            |
| 9   | `demoteOtherVersions`       |

## infos (area)

### beforeOperation

| #   | hook        |
| --- | ----------- |
| 1   | `authorize` |

### beforeRead

| #   | hook                    |
| --- | ----------------------- |
| 1   | `processDocumentFields` |
| 2   | `setDocumentLocale`     |
| 3   | `setDocumentType`       |
| 4   | `exposeVersionId`       |
| 5   | `setDocumentTitle`      |
| 6   | `populateURL`           |
| 7   | `sortDocumentProps`     |

### beforeUpdate

| #   | hook                        |
| --- | --------------------------- |
| 1   | `getOriginalDocument`       |
| 2   | `buildOriginalDocConfigMap` |
| 3   | `resolveContentOwner`       |
| 4   | `defineVersionOperation`    |
| 5   | `handleNewVersion`          |
| 6   | `buildDataConfigMap`        |
| 7   | `setDefaultValues`          |
| 8   | `validateFields`            |
| 9   | `demoteOtherVersions`       |
