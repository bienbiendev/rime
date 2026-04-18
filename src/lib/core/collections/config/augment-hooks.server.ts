import * as authHooks from '$lib/core/collections/auth/hooks/hooks.server.js';
import { mergeWithBlankDocument } from '$lib/core/operations/hooks/before-create/merge-with-blank.server.js';
import { authorize } from '$lib/core/operations/hooks/before-operation/authorize.server.js';
import { populateURL } from '$lib/core/operations/hooks/before-read/populate-url.server.js';
import { processDocumentFields } from '$lib/core/operations/hooks/before-read/process-document-fields.server.js';
import { setDocumentLocale } from '$lib/core/operations/hooks/before-read/set-document-locale.server.js';
import { setDocumentThumbnail } from '$lib/core/operations/hooks/before-read/set-document-thumbnail.server.js';
import { setDocumentTitle } from '$lib/core/operations/hooks/before-read/set-document-title.server.js';
import { setDocumentType } from '$lib/core/operations/hooks/before-read/set-document-type.server.js';
import { sortDocumentProps } from '$lib/core/operations/hooks/before-read/sort-document-props.server.js';
import { defineVersionOperation } from '$lib/core/operations/hooks/before-update/define-version-operation.server.js';
import { getOriginalDocument } from '$lib/core/operations/hooks/before-update/get-original-document.server.js';
import { buildDataConfigMap } from '$lib/core/operations/hooks/before-upsert/data-config-map.server.js';
import { handleNewVersion } from '$lib/core/operations/hooks/before-upsert/handle-new-version.server.js';
import { buildOriginalDocConfigMap } from '$lib/core/operations/hooks/before-upsert/original-config-map.server.js';
import { setDefaultValues } from '$lib/core/operations/hooks/before-upsert/set-default-values.server.js';
import { validateFields } from '$lib/core/operations/hooks/before-upsert/validate-fields.server.js';
import type { Collection, CollectionHooks } from '../../../types.js';
import { populateAPIKey } from '../auth/hooks/after-create/populate-api-key.server.js';
import { removePrivateFields } from '../auth/hooks/before-read/remove-private-fields.server.js';
import { augmentFieldsPassword } from '../auth/hooks/before-upsert/augment-fields-password.server.js';
import { addChildrenProperty } from '../nested/hooks/index.server.js';
import { cleanUpFiles } from '../upload/hooks/clean-up-files.server.js';
import { castBase64ToFile } from '../upload/hooks/convert-base64.server.js';
import { handlePathCreation } from '../upload/hooks/handle-path-creation.server.js';
import { populateSizes } from '../upload/hooks/populate-sizes.server.js';
import { processFileUpload } from '../upload/hooks/process-file-upload.server.js';

type PartialConfig = {
  upload?: Collection<any>['upload'];
  nested?: Collection<any>['nested'];
  auth?: Collection<any>['auth'];
  $hooks?: CollectionHooks<any>;
  $url?: Collection<any>['$url'];
};

/**
 * Augment a collection config with hooks based on different configs
 * upload, url, nesting, auth
 */
export const augmentHooks = <T extends PartialConfig>(collection: T): T => {
  const IS_API_AUTH =
    collection.auth && typeof collection.auth !== 'boolean' && collection.auth.type === 'apiKey';
  //
  const hooks = {
    //
    beforeOperation: [authorize],

    beforeRead: [
      processDocumentFields,
      setDocumentTitle,
      setDocumentLocale,
      setDocumentType,
      ...(collection.upload ? [populateSizes] : []),
      ...(collection.$url ? [populateURL] : []),
      ...(collection.nested ? [addChildrenProperty] : []),
      ...(collection.auth ? [removePrivateFields] : []),
      setDocumentThumbnail,
      sortDocumentProps
    ],

    beforeUpdate: [
      defineVersionOperation,
      getOriginalDocument,
      buildOriginalDocConfigMap,
      handleNewVersion,
      ...(collection.auth
        ? [
            //
            augmentFieldsPassword,
            authHooks.preventSuperAdminMutation,
            authHooks.preventUserMutations,
            authHooks.forwardRolesToBetterAuth
          ]
        : []),
      buildDataConfigMap,
      setDefaultValues,
      validateFields,
      ...(collection.upload ? [handlePathCreation, castBase64ToFile, processFileUpload] : [])
    ],

    afterUpdate: [],

    beforeCreate: [
      ...(collection.auth ? [augmentFieldsPassword] : []),
      mergeWithBlankDocument,
      buildDataConfigMap,
      setDefaultValues,
      validateFields,
      ...(collection.auth ? [authHooks.createBetterAuthUser] : []),
      ...(collection.upload ? [handlePathCreation, castBase64ToFile, processFileUpload] : [])
    ],

    afterCreate: [...(IS_API_AUTH ? [populateAPIKey] : [])],

    beforeDelete: [
      ...(collection.auth ? [authHooks.preventSupperAdminDeletion] : []),
      ...(collection.upload ? [cleanUpFiles] : [])
    ],

    afterDelete: [...(collection.auth ? [authHooks.deleteBetterAuthUser] : [])]
  };

  return {
    ...collection,
    $hooks: {
      beforeOperation: [...hooks.beforeOperation, ...(collection.$hooks?.beforeOperation || [])],
      beforeCreate: [...hooks.beforeCreate, ...(collection.$hooks?.beforeCreate || [])],
      afterCreate: [...hooks.afterCreate, ...(collection.$hooks?.afterCreate || [])],
      beforeUpdate: [...hooks.beforeUpdate, ...(collection.$hooks?.beforeUpdate || [])],
      afterUpdate: [...hooks.afterUpdate, ...(collection.$hooks?.afterUpdate || [])],
      beforeDelete: [...hooks.beforeDelete, ...(collection.$hooks?.beforeDelete || [])],
      afterDelete: [...hooks.afterDelete, ...(collection.$hooks?.afterDelete || [])],
      beforeRead: [...hooks.beforeRead, ...(collection.$hooks?.beforeRead || [])]
    }
  };
};
