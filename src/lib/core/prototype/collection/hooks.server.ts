import * as auth from '$lib/core/auth/hooks/index.server.js';
import * as nested from '$lib/core/prototype/collection/nested/hooks/index.server.js';
import * as thumbnail from '$lib/core/prototype/collection/thumbnail/hooks/index.server.js';
import * as title from '$lib/core/prototype/shared/title/hooks/index.server.js';
import * as upload from '$lib/core/prototype/collection/upload/hooks/index.server.js';
import * as url from '$lib/core/prototype/shared/url/hooks/index.server.js';
import * as versions from '$lib/core/versions/hooks/index.server.js';
import type { AnyHook, HookTiming } from '$lib/core/pipeline/types.js';
import { authorize } from '$lib/core/pipeline/hooks/authorize.server.js';
import { buildDataConfigMap } from '$lib/core/pipeline/hooks/data-config-map.server.js';
import { getOriginalDocument } from '$lib/core/pipeline/hooks/get-original-document.server.js';
import { buildOriginalDocConfigMap } from '$lib/core/pipeline/hooks/original-config-map.server.js';
import { processDocumentFields } from '$lib/core/pipeline/hooks/process-document-fields.server.js';
import { resolveContentOwner } from '$lib/core/pipeline/hooks/resolve-content-owner.server.js';
import { setDefaultValues } from '$lib/core/pipeline/hooks/set-default-values.server.js';
import { setDocumentLocale } from '$lib/core/pipeline/hooks/set-document-locale.server.js';
import { setDocumentType } from '$lib/core/pipeline/hooks/set-document-type.server.js';
import { validateFields } from '$lib/core/pipeline/hooks/validate-fields.server.js';
import { mergeWithBlankDocument } from './hooks/merge-with-blank.server.js';

/**
 * Every hook a collection can run, in the order it runs them.
 *
 * **The order is written here, not computed.** It used to be derived: each hook declared
 * `requires`/`provides` and a resolver sorted them. That bought a generality nothing used —
 * thirteen marks encoding four real dependencies — and paid for it in a failure mode with no
 * symptom: a mark nothing provides is satisfied *vacuously*, so a misspelling did not disable a
 * hook, it hoisted it to the front of the timing. In `beforeUpdate` that is a security question.
 * `preventUserMutations` rejects on `'name' in args.data`, so a default filled in before it turns
 * an ordinary update into a 401 — a constraint that should be two adjacent lines you can read,
 * not an emergent property of nine declarations.
 *
 * A feature still **owns** its hooks; this says when they run. `buildPipeline` filters the list by
 * `feature.enabled(config)`, so a collection without `auth` runs none of auth's.
 *
 * The other direction — a hook a feature owns and this list does not place — never runs and throws
 * nothing. `buildPipeline` cannot see it: a feature carries no hook list any more.
 * `pipeline/hook-placement.spec.ts` checks it off the feature barrels instead, and fails naming
 * the hook.
 *
 * A consumer's hooks are appended after these, per timing. That is the cost of a written order and
 * it is also a fix: under the resolver, a consumer hook that forgot to declare `provides` landed
 * *after* `sortDocumentProps` and its keys came out unsorted, silently.
 *
 * **In its own file rather than in `definition.server.ts`, and that is load-bearing.** A derived
 * collection needs the same list — `upload` derives a `<slug>Directories`, `versions` one per
 * versioned area, and both must run authorize, validation and the rest as an authored collection
 * does. This file depends on nothing, so anything can import it; `definition.server.ts` spreads
 * `{ ...base }` at module scope, so importing *that* makes the importer's correctness depend on
 * evaluation order, and the spread can come out without `features`.
 */
export const collectionHooks: Partial<Record<HookTiming, AnyHook[]>> = {
  beforeOperation: [authorize],

  beforeRead: [
    // First, so nothing deriving from the document can copy a private value into derived data.
    auth.removePrivateFields,
    processDocumentFields,
    setDocumentLocale,
    setDocumentType,
    upload.populateSizes,
    nested.addChildrenProperty,
    versions.exposeVersionId,
    title.setDocumentTitle,
    // After the title: `config.$url(document)` is the author's own function, and a slug built
    // from the title is the ordinary case.
    url.populateURL,
    // After the sizes: it takes the thumbnail `upload.populateSizes` derived when there is one.
    thumbnail.setDocumentThumbnail
  ],

  beforeCreate: [
    mergeWithBlankDocument,
    // After the merge: it appends the password field, and the config map below has to see it.
    auth.augmentFieldsPassword,
    buildDataConfigMap,
    setDefaultValues,
    validateFields,
    auth.createBetterAuthUser,
    upload.handlePathCreation,
    upload.castBase64ToFile,
    upload.processFileUpload
  ],

  afterCreate: [auth.populateAPIKey],

  beforeUpdate: [
    getOriginalDocument,
    buildOriginalDocConfigMap,
    resolveContentOwner,
    auth.augmentFieldsPassword,
    // The three guards read the caller's submission *as sent*, so they run before anything adds
    // to it. `auth.preventUserMutations` rejects on `'name' in args.data` and
    // `auth.preventSuperAdminMutation` on `'isSuperAdmin' in args.data` — a default filled in above
    // either of them turns an ordinary update into a 401.
    auth.preventSuperAdminMutation,
    auth.preventUserMutations,
    auth.forwardRolesToBetterAuth,
    // Also reads the submission as sent, and overrides the content row core resolved above.
    versions.defineVersionOperation,
    versions.handleNewVersion,
    buildDataConfigMap,
    setDefaultValues,
    validateFields,
    upload.handlePathCreation,
    upload.castBase64ToFile,
    upload.processFileUpload,
    // Last: it demotes the other versions once this one is known to be valid and published.
    versions.demoteOtherVersions
  ],

  beforeDelete: [auth.preventSupperAdminDeletion, upload.cleanUpFiles],

  afterDelete: [auth.deleteBetterAuthUser]
};
