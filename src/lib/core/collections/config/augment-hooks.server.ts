import * as authHooks from '$lib/core/features/auth/hooks/index.server.js';
import { mergeWithBlankDocument } from '$lib/core/operations/hooks/before-create/merge-with-blank.server.js';
import { authorize } from '$lib/core/operations/hooks/before-operation/authorize.server.js';
import { populateURL } from '$lib/core/features/url/hooks/populate-url.server.js';
import { processDocumentFields } from '$lib/core/operations/hooks/before-read/process-document-fields.server.js';
import { setDocumentLocale } from '$lib/core/operations/hooks/before-read/set-document-locale.server.js';
import { setDocumentThumbnail } from '$lib/core/operations/hooks/before-read/set-document-thumbnail.server.js';
import { setDocumentTitle } from '$lib/core/operations/hooks/before-read/set-document-title.server.js';
import { setDocumentType } from '$lib/core/operations/hooks/before-read/set-document-type.server.js';
import { sortDocumentProps } from '$lib/core/operations/hooks/before-read/sort-document-props.server.js';
import { defineVersionOperation } from '$lib/core/features/versions/hooks/define-version-operation.server.js';
import { getOriginalDocument } from '$lib/core/operations/hooks/before-update/get-original-document.server.js';
import { buildDataConfigMap } from '$lib/core/operations/hooks/before-upsert/data-config-map.server.js';
import { handleNewVersion } from '$lib/core/features/versions/hooks/handle-new-version.server.js';
import { buildOriginalDocConfigMap } from '$lib/core/operations/hooks/before-upsert/original-config-map.server.js';
import { setDefaultValues } from '$lib/core/operations/hooks/before-upsert/set-default-values.server.js';
import { validateFields } from '$lib/core/operations/hooks/before-upsert/validate-fields.server.js';
import type { Collection, CollectionHooks } from '../../../types.js';
import { populateAPIKey } from '../../features/auth/hooks/populate-api-key.server.js';
import { removePrivateFields } from '../../features/auth/hooks/remove-private-fields.server.js';
import { augmentFieldsPassword } from '../../features/auth/hooks/augment-fields-password.server.js';
import { addChildrenProperty } from '../../features/nested/hooks/add-children.server.js';
import { cleanUpFiles } from '../../features/upload/hooks/clean-up-files.server.js';
import { castBase64ToFile } from '../../features/upload/hooks/convert-base64.server.js';
import { handlePathCreation } from '../../features/upload/hooks/handle-path-creation.server.js';
import { populateSizes } from '../../features/upload/hooks/populate-sizes.server.js';
import { processFileUpload } from '../../features/upload/hooks/process-file-upload.server.js';

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
      // Strip private fields first, before any hook below can copy their value into derived
      // data (e.g. setDocumentTitle reading an arbitrary, collection-author-chosen
      // config.asTitle field, or a consumer's own $url function) — deleting the original key
      // afterwards wouldn't undo a copy already made from it.
      ...(collection.auth ? [removePrivateFields] : []),
      processDocumentFields,
      setDocumentTitle,
      setDocumentLocale,
      setDocumentType,
      ...(collection.upload ? [populateSizes] : []),
      ...(collection.$url ? [populateURL] : []),
      ...(collection.nested ? [addChildrenProperty] : []),
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
