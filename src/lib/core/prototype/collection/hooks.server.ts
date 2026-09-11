import { hasUrl } from '$lib/core/prototype/shared/url/enabled.js';
import { isAuth } from '$lib/core/auth/enabled.js';
import { isNested } from '$lib/core/prototype/collection/nested/enabled.js';
import { isUpload } from '$lib/core/prototype/collection/upload/enabled.js';
import { isVersioned } from '$lib/core/prototype/shared/versions/enabled.js';
import { when } from '$lib/core/prototype/when.js';
import * as auth from '$lib/core/auth/hooks/index.server.js';
import * as metas from '$lib/core/prototype/shared/metas/hooks/index.server.js';
import * as nested from '$lib/core/prototype/collection/nested/hooks/index.server.js';
import * as thumbnail from '$lib/core/prototype/collection/thumbnail/hooks/index.server.js';
import * as title from '$lib/core/prototype/shared/title/hooks/index.server.js';
import * as upload from '$lib/core/prototype/collection/upload/hooks/index.server.js';
import * as url from '$lib/core/prototype/shared/url/hooks/index.server.js';
import * as versions from '$lib/core/prototype/shared/versions/hooks/index.server.js';
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
 * **The order is written here, not computed**, and in `beforeUpdate` that is a security question:
 * `preventUserMutations` rejects on `'name' in args.data`, so a default filled in above it turns
 * an ordinary update into a 401. Two adjacent lines you can read.
 *
 * ```ts
 * when(isAuth, auth.removePrivateFields)   // runs only on a collection that declares `auth`
 * processDocumentFields                    // runs always
 * ```
 *
 * A feature owns its hooks; this says when they run and what they run on.
 *
 * A hook a feature owns and this list does not place never runs, and nothing throws.
 * `pipeline/hook-placement.spec.ts` reads the feature barrels and fails naming the hook.
 *
 * A consumer's hooks are appended after these, per timing, and before the finaliser.
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
    when(isAuth, auth.removePrivateFields),
    processDocumentFields,
    setDocumentLocale,
    setDocumentType,
    when(isUpload, upload.populateSizes),
    when(isNested, nested.addChildrenProperty),
    when(isVersioned, versions.exposeVersionId),
    title.setDocumentTitle,
    // After the title: `config.$url(document)` is the author's own function, and a slug built
    // from the title is the ordinary case.
    when(hasUrl, url.populateURL),
    // After the sizes: it takes the thumbnail `upload.populateSizes` derived when there is one.
    thumbnail.setDocumentThumbnail
  ],

  beforeCreate: [
    mergeWithBlankDocument,
    // After the merge: it appends the password field, and the config map below has to see it.
    when(isAuth, auth.augmentFieldsPassword),
    // Above `buildDataConfigMap`: that map is what the write turns into `incomingPaths`, the set
    // of paths the request may touch, so a field added to `data` below it is dropped in silence.
    metas.stampCreatedBy,
    buildDataConfigMap,
    setDefaultValues,
    validateFields,
    when(isAuth, auth.createBetterAuthUser),
    when(isUpload, upload.handlePathCreation),
    when(isUpload, upload.castBase64ToFile),
    when(isUpload, upload.processFileUpload)
  ],

  afterCreate: [when(isAuth, auth.populateAPIKey), when(isAuth, auth.signInNewUser)],

  beforeUpdate: [
    getOriginalDocument,
    buildOriginalDocConfigMap,
    resolveContentOwner,
    when(isAuth, auth.augmentFieldsPassword),
    // The three guards read the caller's submission *as sent*, so they run before anything adds
    // to it. `auth.preventUserMutations` rejects on `'name' in args.data` and
    // `auth.preventSuperAdminMutation` on `'isSuperAdmin' in args.data` — a default filled in above
    // either of them turns an ordinary update into a 401.
    when(isAuth, auth.preventSuperAdminMutation),
    when(isAuth, auth.preventUserMutations),
    when(isAuth, auth.forwardRolesToBetterAuth),
    // Also reads the submission as sent, and overrides the content row core resolved above.
    when(isVersioned, versions.defineVersionOperation),
    when(isVersioned, versions.handleNewVersion),
    // Between the two: below `handleNewVersion`, which reads the submission *as sent* to work out
    // what the previous version did not carry, and above `buildDataConfigMap`, whose keys are the
    // paths the write may touch — a stamp below that is dropped in silence.
    metas.stampLastEditedBy,
    buildDataConfigMap,
    setDefaultValues,
    validateFields,
    when(isUpload, upload.handlePathCreation),
    when(isUpload, upload.castBase64ToFile),
    when(isUpload, upload.processFileUpload),
    // Last: it demotes the other versions once this one is known to be valid and published.
    when(isVersioned, versions.demoteOtherVersions)
  ],

  beforeDelete: [
    when(isAuth, auth.preventSupperAdminDeletion),
    when(isUpload, upload.cleanUpFiles)
  ],

  afterDelete: [when(isAuth, auth.deleteBetterAuthUser)]
};
