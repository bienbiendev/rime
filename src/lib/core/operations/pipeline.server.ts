import type { Area, AreaHooks, Collection, CollectionHooks } from '$lib/types.js';
import * as authHooks from '../features/auth/hooks/index.server.js';
import { augmentFieldsPassword } from '../features/auth/hooks/augment-fields-password.server.js';
import { populateAPIKey } from '../features/auth/hooks/populate-api-key.server.js';
import { removePrivateFields } from '../features/auth/hooks/remove-private-fields.server.js';
import { addChildrenProperty } from '../features/nested/hooks/add-children.server.js';
import { cleanUpFiles } from '../features/upload/hooks/clean-up-files.server.js';
import { castBase64ToFile } from '../features/upload/hooks/convert-base64.server.js';
import { exctractPath } from '../features/upload/hooks/extract-path.server.js';
import { handlePathCreation } from '../features/upload/hooks/handle-path-creation.server.js';
import { populateSizes } from '../features/upload/hooks/populate-sizes.server.js';
import { processFileUpload } from '../features/upload/hooks/process-file-upload.server.js';
import {
  prepareDirectoryChildren,
  updateDirectoryChildren
} from '../features/upload/hooks/update-directory-children.server.js';
import { populateURL } from '../features/url/hooks/populate-url.server.js';
import { defineVersionOperation } from '../features/versions/hooks/define-version-operation.server.js';
import { handleNewVersion } from '../features/versions/hooks/handle-new-version.server.js';
import { mergeWithBlankDocument } from './steps/merge-with-blank.server.js';
import { authorize } from './steps/authorize.server.js';
import { processDocumentFields } from './steps/process-document-fields.server.js';
import { setDocumentLocale } from './steps/set-document-locale.server.js';
import { setDocumentThumbnail } from './steps/set-document-thumbnail.server.js';
import { setDocumentTitle } from './steps/set-document-title.server.js';
import { setDocumentType } from './steps/set-document-type.server.js';
import { sortDocumentProps } from './steps/sort-document-props.server.js';
import { getOriginalDocument } from './steps/get-original-document.server.js';
import { buildDataConfigMap } from './steps/data-config-map.server.js';
import { buildOriginalDocConfigMap } from './steps/original-config-map.server.js';
import { setDefaultValues } from './steps/set-default-values.server.js';
import { validateFields } from './steps/validate-fields.server.js';

/**
 * Every hook rime runs, and the order it runs them in.
 *
 * This is the one place the document pipeline is written down. Feature folders own the hook
 * *implementations* (features/auth/hooks, features/upload/hooks, ...); this file owns the
 * *order*, spelled out literally. Deliberately not driven by iterating a feature registry —
 * ordering is the interesting part of a pipeline, and a loop would hide it.
 *
 * A collection's and an area's pipelines sit side by side below so their differences are
 * visible rather than spread across two files.
 */

type PartialCollection = {
  upload?: Collection<any>['upload'];
  nested?: Collection<any>['nested'];
  auth?: Collection<any>['auth'];
  $hooks?: CollectionHooks<any>;
  $url?: Collection<any>['$url'];
};

type PartialArea = {
  $hooks?: AreaHooks<any>;
  $url?: Area<any>['$url'];
};

/** The hooks rime contributes to a collection, in order. */
export const collectionPipeline = (collection: PartialCollection) => {
  const IS_API_AUTH =
    collection.auth && typeof collection.auth !== 'boolean' && collection.auth.type === 'apiKey';

  return {
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
};

/**
 * The hooks rime contributes to an area, in order.
 *
 * An area is a single document: no create, no delete, and none of the collection-only
 * features (auth, upload, nested). Note the two deliberate differences from
 * collectionPipeline's beforeRead: populateURL runs before setDocumentType, and there is no
 * thumbnail step.
 */
export const areaPipeline = (area: PartialArea) => ({
  beforeOperation: [authorize],

  beforeRead: [
    //
    processDocumentFields,
    setDocumentTitle,
    setDocumentLocale,
    ...(area.$url ? [populateURL] : []),
    setDocumentType,
    sortDocumentProps
  ],

  beforeUpdate: [
    //
    defineVersionOperation,
    getOriginalDocument,
    buildOriginalDocConfigMap,
    handleNewVersion,
    buildDataConfigMap,
    setDefaultValues,
    validateFields
  ],

  afterUpdate: []
});

/**
 * The hooks for an upload collection's derived `<slug>_directories` collection.
 *
 * Lives here rather than beside the derivation itself (features/upload/directories.server.ts)
 * so that every pipeline rime runs is readable in one file. The result is passed through
 * augmentCollectionHooks below, exactly like an author-written collection.
 */
export const directoriesPipeline = (
  directoriesConfig: { $hooks?: CollectionHooks<any> } | undefined
): CollectionHooks<any> => ({
  beforeOperation: directoriesConfig?.$hooks?.beforeOperation || [],
  beforeCreate: [exctractPath, ...(directoriesConfig?.$hooks?.beforeCreate || [])],
  beforeRead: directoriesConfig?.$hooks?.beforeRead || [],
  beforeUpdate: [
    exctractPath,
    prepareDirectoryChildren,
    ...(directoriesConfig?.$hooks?.beforeUpdate || [])
  ],
  beforeDelete: directoriesConfig?.$hooks?.beforeDelete || [],
  afterCreate: directoriesConfig?.$hooks?.afterCreate || [],
  afterUpdate: [updateDirectoryChildren, ...(directoriesConfig?.$hooks?.afterUpdate || [])],
  afterDelete: directoriesConfig?.$hooks?.afterDelete || []
});

/**
 * Prepends rime's own collection hooks to whatever the config author declared, so a
 * consumer's hooks always run after the built-in ones for the same timing.
 */
export const augmentCollectionHooks = <T extends PartialCollection>(collection: T): T => {
  const hooks = collectionPipeline(collection);

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

/** Same, for an area — only the four timings an area actually has. */
export const augmentAreaHooks = <T extends PartialArea>(area: T): T => {
  const hooks = areaPipeline(area);

  return {
    ...area,
    $hooks: {
      beforeOperation: [...hooks.beforeOperation, ...(area.$hooks?.beforeOperation || [])],
      beforeUpdate: [...hooks.beforeUpdate, ...(area.$hooks?.beforeUpdate || [])],
      afterUpdate: [...hooks.afterUpdate, ...(area.$hooks?.afterUpdate || [])],
      beforeRead: [...hooks.beforeRead, ...(area.$hooks?.beforeRead || [])]
    }
  };
};
