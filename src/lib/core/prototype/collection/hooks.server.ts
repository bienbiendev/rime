import type { AnyHook, HookTiming } from '$lib/core/features/define.js';
import { augmentFieldsPassword } from '$lib/core/features/auth/hooks/augment-fields-password.server.js';
import { createBetterAuthUser } from '$lib/core/features/auth/hooks/create-better-auth-user.server.js';
import { deleteBetterAuthUser } from '$lib/core/features/auth/hooks/delete-better-auth-user.server.js';
import { forwardRolesToBetterAuth } from '$lib/core/features/auth/hooks/forward-roles.server.js';
import { populateAPIKey } from '$lib/core/features/auth/hooks/populate-api-key.server.js';
import { preventSupperAdminDeletion } from '$lib/core/features/auth/hooks/prevent-superadmin-deletion.server.js';
import { preventSuperAdminMutation } from '$lib/core/features/auth/hooks/prevent-superadmin-mutation.server.js';
import { preventUserMutations } from '$lib/core/features/auth/hooks/prevent-user-mutations.server.js';
import { removePrivateFields } from '$lib/core/features/auth/hooks/remove-private-fields.server.js';
import { addChildrenProperty } from '$lib/core/features/nested/hooks/add-children.server.js';
import { setDocumentThumbnail } from '$lib/core/features/thumbnail/hooks/set-document-thumbnail.server.js';
import { setDocumentTitle } from '$lib/core/features/title/hooks/set-document-title.server.js';
import { castBase64ToFile } from '$lib/core/features/upload/hooks/convert-base64.server.js';
import { cleanUpFiles } from '$lib/core/features/upload/hooks/clean-up-files.server.js';
import { handlePathCreation } from '$lib/core/features/upload/hooks/handle-path-creation.server.js';
import { populateSizes } from '$lib/core/features/upload/hooks/populate-sizes.server.js';
import { processFileUpload } from '$lib/core/features/upload/hooks/process-file-upload.server.js';
import { populateURL } from '$lib/core/features/url/hooks/populate-url.server.js';
import { defineVersionOperation } from '$lib/core/features/versions/hooks/define-version-operation.server.js';
import { demoteOtherVersions } from '$lib/core/features/versions/hooks/demote-other-versions.js';
import { exposeVersionId } from '$lib/core/features/versions/hooks/expose-version-id.js';
import { handleNewVersion } from '$lib/core/features/versions/hooks/handle-new-version.server.js';
import { authorize } from '$lib/core/pipeline/steps/authorize.server.js';
import { buildDataConfigMap } from '$lib/core/pipeline/steps/data-config-map.server.js';
import { getOriginalDocument } from '$lib/core/pipeline/steps/get-original-document.server.js';
import { buildOriginalDocConfigMap } from '$lib/core/pipeline/steps/original-config-map.server.js';
import { processDocumentFields } from '$lib/core/pipeline/steps/process-document-fields.server.js';
import { resolveContentOwner } from '$lib/core/pipeline/steps/resolve-content-owner.server.js';
import { setDefaultValues } from '$lib/core/pipeline/steps/set-default-values.server.js';
import { setDocumentLocale } from '$lib/core/pipeline/steps/set-document-locale.server.js';
import { setDocumentType } from '$lib/core/pipeline/steps/set-document-type.server.js';
import { validateFields } from '$lib/core/pipeline/steps/validate-fields.server.js';
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
 * `feature.enabled(config)`, so a collection without `auth` runs none of auth's, and refuses to
 * boot if a feature contributes a hook this list does not place.
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
    removePrivateFields,
    processDocumentFields,
    setDocumentLocale,
    setDocumentType,
    populateSizes,
    addChildrenProperty,
    exposeVersionId,
    setDocumentTitle,
    // After the title: `config.$url(document)` is the author's own function, and a slug built
    // from the title is the ordinary case.
    populateURL,
    // After the sizes: it takes the thumbnail `populateSizes` derived when there is one.
    setDocumentThumbnail
  ],

  beforeCreate: [
    mergeWithBlankDocument,
    // After the merge: it appends the password field, and the config map below has to see it.
    augmentFieldsPassword,
    buildDataConfigMap,
    setDefaultValues,
    validateFields,
    createBetterAuthUser,
    handlePathCreation,
    castBase64ToFile,
    processFileUpload
  ],

  afterCreate: [populateAPIKey],

  beforeUpdate: [
    getOriginalDocument,
    buildOriginalDocConfigMap,
    resolveContentOwner,
    augmentFieldsPassword,
    // The three guards read the caller's submission *as sent*, so they run before anything adds
    // to it. `preventUserMutations` rejects on `'name' in args.data` and
    // `preventSuperAdminMutation` on `'isSuperAdmin' in args.data` — a default filled in above
    // either of them turns an ordinary update into a 401.
    preventSuperAdminMutation,
    preventUserMutations,
    forwardRolesToBetterAuth,
    // Also reads the submission as sent, and overrides the content row core resolved above.
    defineVersionOperation,
    handleNewVersion,
    buildDataConfigMap,
    setDefaultValues,
    validateFields,
    handlePathCreation,
    castBase64ToFile,
    processFileUpload,
    // Last: it demotes the other versions once this one is known to be valid and published.
    demoteOtherVersions
  ],

  beforeDelete: [preventSupperAdminDeletion, cleanUpFiles],

  afterDelete: [deleteBetterAuthUser]
};
