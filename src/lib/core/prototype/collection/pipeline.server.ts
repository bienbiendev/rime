import type { Collection, CollectionHooks } from '$lib/types.js';
import * as authHooks from '$lib/core/features/auth/hooks/index.server.js';
import { augmentFieldsPassword } from '$lib/core/features/auth/hooks/augment-fields-password.server.js';
import { populateAPIKey } from '$lib/core/features/auth/hooks/populate-api-key.server.js';
import { removePrivateFields } from '$lib/core/features/auth/hooks/remove-private-fields.server.js';
import { defineVersionOperation } from '$lib/core/features/versions/hooks/define-version-operation.server.js';
import { handleNewVersion } from '$lib/core/features/versions/hooks/handle-new-version.server.js';
import { buildPipeline } from '$lib/core/operations/build-pipeline.server.js';
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
 * The hooks a collection contributes to its own pipeline.
 *
 * **Its own, and nothing else's.** Where a feature's hooks belong in this list is not stated here
 * and cannot be: this file names no feature, so extending a collection never means editing it.
 * `buildPipeline` merges what the registry offers for each timing and `resolvePipeline` decides
 * the order from what every hook declares about itself.
 *
 * Until this commit these lists interleaved `...featureHooks(upload, collection, 'beforeRead')`
 * by hand — a prototype naming a feature, which is backwards: features extend prototypes. That
 * inversion is what made the feature layer decorative, since adding one still meant editing the
 * thing it was supposed to extend.
 *
 * What remains is genuinely the collection's own. `auth` is core rather than a feature
 * (docs/architecture-target.md settles that), and versions' two update hooks run for *every*
 * config, versioned or not — `defineVersionOperation` populates the context that
 * `assertUpsertContext` then requires — so gating them behind a feature would break
 * non-versioned updates.
 */
const ownHooks = (collection: PartialCollection) => {
  const IS_API_AUTH =
    collection.auth && typeof collection.auth !== 'boolean' && collection.auth.type === 'apiKey';

  return {
    beforeOperation: [authorize],

    beforeRead: [
      // Strips private fields, and everything deriving from the document waits on the mark it
      // leaves (`sanitized`) rather than on its position — so no hook can copy a private value
      // into derived data before it runs, whether or not anyone remembers to keep it first.
      ...(collection.auth ? [removePrivateFields] : []),
      processDocumentFields,
      setDocumentTitle,
      setDocumentLocale,
      setDocumentType,
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
            augmentFieldsPassword,
            authHooks.preventSuperAdminMutation,
            authHooks.preventUserMutations,
            authHooks.forwardRolesToBetterAuth
          ]
        : []),
      buildDataConfigMap,
      setDefaultValues,
      validateFields
    ],

    afterUpdate: [],

    beforeCreate: [
      mergeWithBlankDocument,
      ...(collection.auth ? [augmentFieldsPassword] : []),
      buildDataConfigMap,
      setDefaultValues,
      validateFields,
      ...(collection.auth ? [authHooks.createBetterAuthUser] : [])
    ],

    afterCreate: [...(IS_API_AUTH ? [populateAPIKey] : [])],

    beforeDelete: [...(collection.auth ? [authHooks.preventSupperAdminDeletion] : [])],

    afterDelete: [...(collection.auth ? [authHooks.deleteBetterAuthUser] : [])]
  };
};

/**
 * Only what the collection's *own* hooks read.
 *
 * It used to also list `upload`, `nested` and `$url` — the properties the interleaved
 * `featureHooks(...)` calls tested. Those are each a feature's business now: the config travels
 * on to the registry, and each feature's own `enabled` decides from it. A prototype naming them
 * even in a type is the same inversion in smaller print.
 */
type PartialCollection = {
  slug?: string;
  auth?: Collection<any>['auth'];
  $hooks?: CollectionHooks<any>;
};

/** The collection's own hooks, whatever the registry's features contribute, and the consumer's —
 *  merged and ordered. */
export const augmentCollectionHooks = <T extends PartialCollection>(collection: T): T => ({
  ...collection,
  $hooks: buildPipeline('collection', collection, ownHooks(collection), collection.$hooks)
});
