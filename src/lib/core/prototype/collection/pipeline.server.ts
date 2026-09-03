import type { Collection, CollectionHooks } from '$lib/types.js';
import * as authHooks from '$lib/core/features/auth/hooks/index.server.js';
import { augmentFieldsPassword } from '$lib/core/features/auth/hooks/augment-fields-password.server.js';
import { populateAPIKey } from '$lib/core/features/auth/hooks/populate-api-key.server.js';
import { removePrivateFields } from '$lib/core/features/auth/hooks/remove-private-fields.server.js';
import { featureHooks, nested, upload, url } from '$lib/core/features/registry.js';
import { defineVersionOperation } from '$lib/core/features/versions/hooks/define-version-operation.server.js';
import { handleNewVersion } from '$lib/core/features/versions/hooks/handle-new-version.server.js';
import { authorize } from '$lib/core/operations/steps/authorize.server.js';
import { buildDataConfigMap } from '$lib/core/operations/steps/data-config-map.server.js';
import { getOriginalDocument } from '$lib/core/operations/steps/get-original-document.server.js';
import { mergeWithBlankDocument } from '$lib/core/operations/steps/merge-with-blank.server.js';
import { buildOriginalDocConfigMap } from '$lib/core/operations/steps/original-config-map.server.js';
import { processDocumentFields } from '$lib/core/operations/steps/process-document-fields.server.js';
import { setDefaultValues } from '$lib/core/operations/steps/set-default-values.server.js';
import { setDocumentLocale } from '$lib/core/operations/steps/set-document-locale.server.js';
import { setDocumentThumbnail } from '$lib/core/operations/steps/set-document-thumbnail.server.js';
import { setDocumentTitle } from '$lib/core/operations/steps/set-document-title.server.js';
import { setDocumentType } from '$lib/core/operations/steps/set-document-type.server.js';
import { sortDocumentProps } from '$lib/core/operations/steps/sort-document-props.server.js';
import { validateFields } from '$lib/core/operations/steps/validate-fields.server.js';

/**
 * Every hook rime runs on a collection, and the order it runs them in.
 *
 * The prototype owns its own pipeline, next to the operations that run it. Feature folders own
 * the hook *implementations* and the condition that enables them — `featureHooks(url,
 * collection, 'beforeRead')` contributes nothing unless that config declares `$url`. This file
 * owns the *order*, spelled out literally. Deliberately not driven by iterating a feature
 * registry: ordering is the interesting part of a pipeline, and a loop would hide it. Nor could
 * a loop find this order — the features that interleave here require nothing of each other, and
 * what they are really ordered against is the core steps around them.
 *
 * The area pipeline is its own file, beside its own operations. Two deliberate differences to
 * know about, previously visible because both sat in one file: an area runs `populateURL` before
 * `setDocumentType`, and has no thumbnail step.
 */

type PartialCollection = {
  upload?: Collection<any>['upload'];
  nested?: Collection<any>['nested'];
  auth?: Collection<any>['auth'];
  $hooks?: CollectionHooks<any>;
  $url?: Collection<any>['$url'];
};

/**
 * The pipeline's return type, annotated rather than inferred.
 *
 * CollectionHooks always typed every timing correctly, but this function returned an inferred
 * object literal, so nothing was compared against it and a `beforeRead` hook could sit in
 * `afterDelete` with no error anywhere. `Required<…>` because rime contributes every timing,
 * even when the array is empty.
 */
type CollectionPipeline = Required<CollectionHooks<any>>;

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
      ...featureHooks(upload, collection, 'beforeRead'),
      ...featureHooks(url, collection, 'beforeRead'),
      ...featureHooks(nested, collection, 'beforeRead'),
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
      ...featureHooks(upload, collection, 'beforeUpdate')
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
      ...featureHooks(upload, collection, 'beforeCreate')
    ],

    afterCreate: [...(IS_API_AUTH ? [populateAPIKey] : [])],

    beforeDelete: [
      ...(collection.auth ? [authHooks.preventSupperAdminDeletion] : []),
      ...featureHooks(upload, collection, 'beforeDelete')
    ],

    afterDelete: [...(collection.auth ? [authHooks.deleteBetterAuthUser] : [])]
  };
};

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
