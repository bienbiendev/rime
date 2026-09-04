# Pipelines

`· name` marks a hook a feature contributed. `anonymous` is one your config contributed
without naming it — every rime-owned hook is named, and boot warns if one is not.

## pages (collection)

```
pages (collection)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ processDocumentFields
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ addChildrenProperty   · nested
│  ├─ setDocumentTitle      · title
│  ├─ populateURL           · url
│  ├─ anonymous
│  ├─ setDocumentThumbnail  · thumbnail
│  └─ sortDocumentProps
├─ beforeCreate
│  ├─ mergeWithBlankDocument
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  ├─ validateFields
│  └─ anonymous
├─ afterCreate
│  └─ anonymous
├─ beforeUpdate
│  ├─ defineVersionOperation
│  ├─ getOriginalDocument
│  ├─ buildOriginalDocConfigMap
│  ├─ handleNewVersion
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  ├─ validateFields
│  └─ anonymous
└─ afterUpdate
   └─ anonymous
```

## medias (collection)

```
medias (collection)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ processDocumentFields
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ populateSizes         · upload
│  ├─ setDocumentTitle      · title
│  ├─ setDocumentThumbnail  · thumbnail
│  └─ sortDocumentProps
├─ beforeCreate
│  ├─ mergeWithBlankDocument
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  ├─ validateFields
│  ├─ handlePathCreation  · upload
│  ├─ castBase64ToFile    · upload
│  └─ processFileUpload   · upload
├─ beforeUpdate
│  ├─ defineVersionOperation
│  ├─ getOriginalDocument
│  ├─ buildOriginalDocConfigMap
│  ├─ handleNewVersion
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  ├─ validateFields
│  ├─ handlePathCreation  · upload
│  ├─ castBase64ToFile    · upload
│  └─ processFileUpload   · upload
└─ beforeDelete
   └─ cleanUpFiles  · upload
```

## news (collection)

```
news (collection)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ processDocumentFields
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ setDocumentTitle      · title
│  ├─ populateURL           · url
│  ├─ setDocumentThumbnail  · thumbnail
│  └─ sortDocumentProps
├─ beforeCreate
│  ├─ mergeWithBlankDocument
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  └─ validateFields
└─ beforeUpdate
   ├─ defineVersionOperation
   ├─ getOriginalDocument
   ├─ buildOriginalDocConfigMap
   ├─ handleNewVersion
   ├─ buildDataConfigMap
   ├─ setDefaultValues
   └─ validateFields
```

## users (collection)

```
users (collection)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ removePrivateFields   · auth
│  ├─ processDocumentFields
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ setDocumentTitle      · title
│  ├─ setDocumentThumbnail  · thumbnail
│  └─ sortDocumentProps
├─ beforeCreate
│  ├─ mergeWithBlankDocument
│  ├─ augmentFieldsPassword  · auth
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  ├─ validateFields
│  └─ createBetterAuthUser   · auth
├─ afterCreate
│  └─ populateAPIKey  · auth
├─ beforeUpdate
│  ├─ defineVersionOperation
│  ├─ getOriginalDocument
│  ├─ buildOriginalDocConfigMap
│  ├─ handleNewVersion
│  ├─ augmentFieldsPassword      · auth
│  ├─ preventSuperAdminMutation  · auth
│  ├─ preventUserMutations       · auth
│  ├─ forwardRolesToBetterAuth   · auth
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  └─ validateFields
├─ beforeDelete
│  └─ preventSupperAdminDeletion  · auth
└─ afterDelete
   └─ deleteBetterAuthUser  · auth
```

## apps (collection)

```
apps (collection)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ removePrivateFields   · auth
│  ├─ processDocumentFields
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ setDocumentTitle      · title
│  ├─ setDocumentThumbnail  · thumbnail
│  └─ sortDocumentProps
├─ beforeCreate
│  ├─ mergeWithBlankDocument
│  ├─ augmentFieldsPassword  · auth
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  ├─ validateFields
│  └─ createBetterAuthUser   · auth
├─ afterCreate
│  └─ populateAPIKey  · auth
├─ beforeUpdate
│  ├─ defineVersionOperation
│  ├─ getOriginalDocument
│  ├─ buildOriginalDocConfigMap
│  ├─ handleNewVersion
│  ├─ augmentFieldsPassword      · auth
│  ├─ preventSuperAdminMutation  · auth
│  ├─ preventUserMutations       · auth
│  ├─ forwardRolesToBetterAuth   · auth
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  └─ validateFields
├─ beforeDelete
│  └─ preventSupperAdminDeletion  · auth
└─ afterDelete
   └─ deleteBetterAuthUser  · auth
```

## staff (collection)

```
staff (collection)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ removePrivateFields   · auth
│  ├─ processDocumentFields
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ setDocumentTitle      · title
│  ├─ setDocumentThumbnail  · thumbnail
│  └─ sortDocumentProps
├─ beforeCreate
│  ├─ mergeWithBlankDocument
│  ├─ augmentFieldsPassword  · auth
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  ├─ validateFields
│  └─ createBetterAuthUser   · auth
├─ afterCreate
│  └─ populateAPIKey  · auth
├─ beforeUpdate
│  ├─ defineVersionOperation
│  ├─ getOriginalDocument
│  ├─ buildOriginalDocConfigMap
│  ├─ handleNewVersion
│  ├─ augmentFieldsPassword      · auth
│  ├─ preventSuperAdminMutation  · auth
│  ├─ preventUserMutations       · auth
│  ├─ forwardRolesToBetterAuth   · auth
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  └─ validateFields
├─ beforeDelete
│  └─ preventSupperAdminDeletion  · auth
└─ afterDelete
   └─ deleteBetterAuthUser  · auth
```

## $mediasDirectories (collection)

```
$mediasDirectories (collection)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ processDocumentFields
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ setDocumentTitle      · title
│  ├─ setDocumentThumbnail  · thumbnail
│  └─ sortDocumentProps
├─ beforeCreate
│  ├─ mergeWithBlankDocument
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  ├─ validateFields
│  └─ exctractPath
├─ beforeUpdate
│  ├─ defineVersionOperation
│  ├─ getOriginalDocument
│  ├─ buildOriginalDocConfigMap
│  ├─ handleNewVersion
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  ├─ validateFields
│  ├─ exctractPath
│  └─ prepareDirectoryChildren
└─ afterUpdate
   └─ updateDirectoryChildren
```

## settings (area)

```
settings (area)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ processDocumentFields
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ setDocumentTitle  · title
│  └─ sortDocumentProps
└─ beforeUpdate
   ├─ defineVersionOperation
   ├─ getOriginalDocument
   ├─ buildOriginalDocConfigMap
   ├─ handleNewVersion
   ├─ buildDataConfigMap
   ├─ setDefaultValues
   └─ validateFields
```

## navigation (area)

```
navigation (area)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ processDocumentFields
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ setDocumentTitle  · title
│  └─ sortDocumentProps
└─ beforeUpdate
   ├─ defineVersionOperation
   ├─ getOriginalDocument
   ├─ buildOriginalDocConfigMap
   ├─ handleNewVersion
   ├─ buildDataConfigMap
   ├─ setDefaultValues
   └─ validateFields
```

## infos (area)

```
infos (area)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ processDocumentFields
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ setDocumentTitle  · title
│  └─ sortDocumentProps
└─ beforeUpdate
   ├─ defineVersionOperation
   ├─ getOriginalDocument
   ├─ buildOriginalDocConfigMap
   ├─ handleNewVersion
   ├─ buildDataConfigMap
   ├─ setDefaultValues
   └─ validateFields
```
