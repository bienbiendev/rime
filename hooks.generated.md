# Pipelines

## pages (collection)

```
pages (collection)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ processDocumentFields
│  ├─ setDocumentTitle
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ addChildrenProperty  · nested
│  ├─ populateURL          · url
│  ├─ anonymous
│  ├─ setDocumentThumbnail
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
│  ├─ setDocumentTitle
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ populateSizes  · upload
│  ├─ setDocumentThumbnail
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
│  ├─ setDocumentTitle
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ populateURL  · url
│  ├─ setDocumentThumbnail
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
│  ├─ removePrivateFields
│  ├─ processDocumentFields
│  ├─ setDocumentTitle
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ setDocumentThumbnail
│  └─ sortDocumentProps
├─ beforeCreate
│  ├─ mergeWithBlankDocument
│  ├─ augmentFieldsPassword
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  ├─ validateFields
│  └─ createBetterAuthUser
├─ beforeUpdate
│  ├─ defineVersionOperation
│  ├─ getOriginalDocument
│  ├─ buildOriginalDocConfigMap
│  ├─ handleNewVersion
│  ├─ augmentFieldsPassword
│  ├─ preventSuperAdminMutation
│  ├─ preventUserMutations
│  ├─ forwardRolesToBetterAuth
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  └─ validateFields
├─ beforeDelete
│  └─ preventSupperAdminDeletion
└─ afterDelete
   └─ deleteBetterAuthUser
```

## apps (collection)

```
apps (collection)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ removePrivateFields
│  ├─ processDocumentFields
│  ├─ setDocumentTitle
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ setDocumentThumbnail
│  └─ sortDocumentProps
├─ beforeCreate
│  ├─ mergeWithBlankDocument
│  ├─ augmentFieldsPassword
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  ├─ validateFields
│  └─ createBetterAuthUser
├─ afterCreate
│  └─ populateAPIKey
├─ beforeUpdate
│  ├─ defineVersionOperation
│  ├─ getOriginalDocument
│  ├─ buildOriginalDocConfigMap
│  ├─ handleNewVersion
│  ├─ augmentFieldsPassword
│  ├─ preventSuperAdminMutation
│  ├─ preventUserMutations
│  ├─ forwardRolesToBetterAuth
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  └─ validateFields
├─ beforeDelete
│  └─ preventSupperAdminDeletion
└─ afterDelete
   └─ deleteBetterAuthUser
```

## staff (collection)

```
staff (collection)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ removePrivateFields
│  ├─ processDocumentFields
│  ├─ setDocumentTitle
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ setDocumentThumbnail
│  └─ sortDocumentProps
├─ beforeCreate
│  ├─ mergeWithBlankDocument
│  ├─ augmentFieldsPassword
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  ├─ validateFields
│  └─ createBetterAuthUser
├─ beforeUpdate
│  ├─ defineVersionOperation
│  ├─ getOriginalDocument
│  ├─ buildOriginalDocConfigMap
│  ├─ handleNewVersion
│  ├─ augmentFieldsPassword
│  ├─ preventSuperAdminMutation
│  ├─ preventUserMutations
│  ├─ forwardRolesToBetterAuth
│  ├─ buildDataConfigMap
│  ├─ setDefaultValues
│  └─ validateFields
├─ beforeDelete
│  └─ preventSupperAdminDeletion
└─ afterDelete
   └─ deleteBetterAuthUser
```

## $mediasDirectories (collection)

```
$mediasDirectories (collection)
├─ beforeOperation
│  └─ authorize
├─ beforeRead
│  ├─ processDocumentFields
│  ├─ setDocumentTitle
│  ├─ setDocumentLocale
│  ├─ setDocumentType
│  ├─ setDocumentThumbnail
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
│  ├─ setDocumentTitle
│  ├─ setDocumentLocale
│  ├─ setDocumentType
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
│  ├─ setDocumentTitle
│  ├─ setDocumentLocale
│  ├─ setDocumentType
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
│  ├─ setDocumentTitle
│  ├─ setDocumentLocale
│  ├─ setDocumentType
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
