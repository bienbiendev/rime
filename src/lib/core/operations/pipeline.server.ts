import type { Area, AreaHooks, Collection, CollectionHooks } from '$lib/types.js';
import * as authHooks from '../features/auth/hooks/index.server.js';
import { augmentFieldsPassword } from '../features/auth/hooks/augment-fields-password.server.js';
import { populateAPIKey } from '../features/auth/hooks/populate-api-key.server.js';
import { removePrivateFields } from '../features/auth/hooks/remove-private-fields.server.js';
import { addChildrenProperty } from '../features/nested/hooks/add-children.server.js';
import { uploadRuntime } from '../features/upload/runtime.server.js';
import { urlRuntime } from '../features/url/runtime.server.js';
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

/**
 * Hooks come from the features that own them, pulled out here so the pipelines below read as
 * sequences of names rather than of property accesses. The features declare *which* hooks exist,
 * at *which timing*, and *whether* they apply; this file decides *when* within that timing they
 * run, and that is the only thing it decides.
 *
 * Destructuring per timing is not cosmetic: `uploadRuntime.hooks.beforeUpsert` is typed
 * `Record<string, Hook<any, 'create' | 'update', 'before'>>`, so a hook can only be pulled into
 * an array its own signature fits. Before the map was keyed this way, a `beforeRead` hook could
 * be placed in `afterDelete` with no error anywhere.
 *
 * Deliberately the `runtime.server.ts` half of each feature, never the whole feature: the boot
 * half reaches derive → directories.server.ts → back to this file, and since these bindings are
 * read at module scope a cycle would silently yield `undefined` instead of throwing. See
 * features/upload/runtime.server.ts.
 */
const { populateSizes } = uploadRuntime.hooks.beforeRead;
const { handlePathCreation, castBase64ToFile, processFileUpload, exctractPath } =
  uploadRuntime.hooks.beforeUpsert;
const { prepareDirectoryChildren } = uploadRuntime.hooks.beforeUpdate;
const { updateDirectoryChildren } = uploadRuntime.hooks.afterUpdate;
const { cleanUpFiles } = uploadRuntime.hooks.beforeDelete;
const { populateURL } = urlRuntime.hooks.beforeRead;

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

/**
 * The pipelines' return types, annotated rather than inferred — and that annotation is the
 * thing that makes a misplaced hook a compile error.
 *
 * Keying a feature's `hooks` map by timing constrains what the *feature* may declare, but an
 * inferred object literal here would still happily accept a `beforeRead` hook in `afterDelete`:
 * nothing was checking the arrays. `CollectionHooks`/`AreaHooks` already type every timing
 * correctly; the pipelines simply never said so. `Required<…>` because rime contributes every
 * timing, even when the array is empty.
 */
type CollectionPipeline = Required<CollectionHooks<any>>;
type AreaPipeline = Required<AreaHooks<any>>;

/** The hooks rime contributes to a collection, in order. */
export const collectionPipeline = (collection: PartialCollection): CollectionPipeline => {
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
      ...(uploadRuntime.enabled(collection) ? [populateSizes] : []),
      ...(urlRuntime.enabled(collection) ? [populateURL] : []),
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
            // Immediately before buildDataConfigMap, which is the point of it: it appends the
            // password field to the config so the config map — and therefore validation —
            // covers it.
            augmentFieldsPassword,
            authHooks.preventSuperAdminMutation,
            authHooks.preventUserMutations,
            authHooks.forwardRolesToBetterAuth
          ]
        : []),
      buildDataConfigMap,
      setDefaultValues,
      validateFields,
      ...(uploadRuntime.enabled(collection) ? [handlePathCreation, castBase64ToFile, processFileUpload] : [])
    ],

    afterUpdate: [],

    beforeCreate: [
      mergeWithBlankDocument,
      // After mergeWithBlankDocument, never before — the blank document is built from
      // config.fields, so augmenting first gives every create a blank `password` that then
      // fails its own .required() check. See the hook for the paths that legitimately have
      // no password.
      ...(collection.auth ? [augmentFieldsPassword] : []),
      buildDataConfigMap,
      setDefaultValues,
      validateFields,
      ...(collection.auth ? [authHooks.createBetterAuthUser] : []),
      ...(uploadRuntime.enabled(collection) ? [handlePathCreation, castBase64ToFile, processFileUpload] : [])
    ],

    afterCreate: [...(IS_API_AUTH ? [populateAPIKey] : [])],

    beforeDelete: [
      ...(collection.auth ? [authHooks.preventSupperAdminDeletion] : []),
      ...(uploadRuntime.enabled(collection) ? [cleanUpFiles] : [])
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
export const areaPipeline = (area: PartialArea): AreaPipeline => ({
  beforeOperation: [authorize],

  beforeRead: [
    //
    processDocumentFields,
    setDocumentTitle,
    setDocumentLocale,
    ...(urlRuntime.enabled(area) ? [populateURL] : []),
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
