import { isAuth, isStaffCollection } from '#lib/core/auth/enabled.js';
import * as auth from '#lib/core/auth/hooks/index.server.js';
import { authorize } from '#lib/core/pipeline/hooks/authorize.server.js';
import { completeNewRows } from '#lib/core/pipeline/hooks/complete-new-rows.server.js';
import { buildDataConfigMap } from '#lib/core/pipeline/hooks/data-config-map.server.js';
import { getOriginalDocument } from '#lib/core/pipeline/hooks/get-original-document.server.js';
import { normalizeResolvedReferences } from '#lib/core/pipeline/hooks/normalize-resolved-references.server.js';
import { buildOriginalDocConfigMap } from '#lib/core/pipeline/hooks/original-config-map.server.js';
import { processDocumentFields } from '#lib/core/pipeline/hooks/process-document-fields.server.js';
import { resolveContentOwner } from '#lib/core/pipeline/hooks/resolve-content-owner.server.js';
import { setDefaultValues } from '#lib/core/pipeline/hooks/set-default-values.server.js';
import { setDocumentLocale } from '#lib/core/pipeline/hooks/set-document-locale.server.js';
import { setDocumentType } from '#lib/core/pipeline/hooks/set-document-type.server.js';
import { validateFields } from '#lib/core/pipeline/hooks/validate-fields.server.js';
import type { AnyHook, HookTiming } from '#lib/core/pipeline/types.js';
import { isNested } from '#lib/core/prototype/collection/nested/enabled.js';
import * as nested from '#lib/core/prototype/collection/nested/hooks/index.server.js';
import * as thumbnail from '#lib/core/prototype/collection/thumbnail/hooks/index.server.js';
import { isUpload } from '#lib/core/prototype/collection/upload/enabled.js';
import * as upload from '#lib/core/prototype/collection/upload/hooks/index.server.js';
import * as metas from '#lib/core/prototype/shared/metas/hooks/index.server.js';
import * as title from '#lib/core/prototype/shared/title/hooks/index.server.js';
import { hasUrl } from '#lib/core/prototype/shared/url/enabled.js';
import * as url from '#lib/core/prototype/shared/url/hooks/index.server.js';
import { isVersioned, isVersionsCollection } from '#lib/core/prototype/shared/versions/enabled.js';
import * as versions from '#lib/core/prototype/shared/versions/hooks/index.server.js';
import { when } from '#lib/core/prototype/when.js';
import { mergeWithInitialDocument } from './hooks/merge-with-initial.server.js';

/**
 * Every hook a collection can run, in the order it runs them.
 *
 * **The order is written here, not computed.** In `beforeUpdate` it is a security question: see
 * the guards there.
 *
 * ```ts
 * when(isAuth, auth.removePrivateFields)   // runs only on a collection that declares `auth`
 * processDocumentFields                    // runs always
 * ```
 *
 * A feature owns its hooks; this says when they run and what they run on.
 *
 * A hook a feature owns and this list does not place never runs, and nothing throws: placing it
 * here is what runs it.
 *
 * A consumer's hooks are appended after these, per timing, and before the finaliser.
 *
 * **In its own file rather than in `definition.server.ts`, and that is load-bearing.** A derived
 * collection needs the same list — `upload` derives a `<slug>Directories`, `versions` one per
 * versioned area, and both must run authorize, validation and the rest as an authored collection
 * does. This file depends on nothing, so anything can import it. `definition.server.ts` spreads
 * `{ ...base }` at module scope, so an importer of it depends on evaluation order, and the only
 * symptom of a wrong order is a missing title.
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
    // The live edit link, from the url the read joined.
    when(hasUrl, url.setLiveUrl),
    // After the sizes: it takes the thumbnail `upload.populateSizes` derived when there is one.
    thumbnail.setDocumentThumbnail,
    metas.deletePanelLockMetas
  ],

  beforeCreate: [
    // First, on the submission as sent. Unconditional: the derived versions collection carries
    // the flag and is not itself versioned.
    versions.stripAutoSaveFlag,
    mergeWithInitialDocument,
    // A new block or tree item: the fields it did not send, as the merge above does for the document
    completeNewRows,
    // After the merge: it appends the password field, and the config map below has to see it.
    when(isAuth, auth.augmentFieldsPassword),
    // Above `buildDataConfigMap`: the write saves the blocks, tree items and relations that map
    // holds, so one added to `data` below it is dropped in silence. A plain column added below it
    // is written, unchecked by `validateFields`.
    metas.stampCreatedBy,
    setDefaultValues,
    buildDataConfigMap,
    // Above validation, which reads an id where a read handed back the document.
    normalizeResolvedReferences,
    validateFields,
    when(isAuth, auth.createBetterAuthUser),
    when(isUpload, upload.handlePathCreation),
    when(isUpload, upload.castBase64ToFile),
    when(isUpload, upload.processFileUpload)
  ],

  afterCreate: [
    when(isAuth, auth.populateAPIKey),
    when(isAuth, auth.signInNewUser),
    when(hasUrl, url.createPaths)
  ],

  afterUpdate: [when(hasUrl, url.syncPaths), when(isUpload, upload.cleanUpReplacedFiles)],

  beforeUpdate: [
    versions.stripAutoSaveFlag,
    getOriginalDocument,
    // Reads `_parent` as sent. Before the write, which stores it on the base row.
    when(isNested, nested.refuseCyclicParent),
    buildOriginalDocConfigMap,
    resolveContentOwner,
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
    // what the previous version did not carry, and above `buildDataConfigMap`. The write saves the
    // blocks, tree items and relations that map holds, so a default for one of them added below it
    // is dropped in silence; a plain column added below it is written, unchecked by
    // `validateFields`.
    metas.stampUpdatedBy,
    completeNewRows,
    setDefaultValues,
    buildDataConfigMap,
    normalizeResolvedReferences,
    validateFields,
    // Before the upload hooks: a refusal from better-auth fails the save before anything is written.
    when(isAuth, auth.forwardRolesToApiKey),
    when(isUpload, upload.handlePathCreation),
    when(isUpload, upload.castBase64ToFile),
    when(isUpload, upload.processFileUpload),
    // Last: it demotes the other versions once this one is known to be valid and published.
    when(isVersioned, versions.demoteOtherVersions)
  ],

  beforeDelete: [
    // On the versions collection only, where the document *is* the row. On the base collection
    // a delete means the whole document, whichever row was read for it.
    when(isVersionsCollection, versions.preventLastVersionDeletion),
    when(isAuth, auth.preventSupperAdminDeletion),
    // After the refusal above: a user who cannot be deleted keeps their auto-saves.
    when(isStaffCollection, versions.discardAutoSavesOf),
    when(isUpload, upload.collectFiles),
    // Its children go to the top with their addresses, before its own go by cascade.
    when(hasUrl, url.detachPaths)
  ],

  afterDelete: [when(isAuth, auth.deleteBetterAuthUser), when(isUpload, upload.cleanUpFiles)]
};
