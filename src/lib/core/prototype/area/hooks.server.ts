import { hasUrl } from '$lib/core/prototype/shared/url/enabled.js';
import { isVersioned } from '$lib/core/prototype/shared/versions/enabled.js';
import { when } from '$lib/core/prototype/when.js';
import * as metas from '$lib/core/prototype/shared/metas/hooks/index.server.js';
import * as title from '$lib/core/prototype/shared/title/hooks/index.server.js';
import * as url from '$lib/core/prototype/shared/url/hooks/index.server.js';
import * as versions from '$lib/core/prototype/shared/versions/hooks/index.server.js';
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
import type { AnyHook, HookTiming } from '$lib/core/pipeline/types.js';

/**
 * The area prototype's *own* document hooks — the ones that are its, unconditionally.
 *
 * In its own file for the reason the collection's are (see collection/hooks.server.ts): a list of
 * hooks depends on nothing, so anything can import it without going through `definition.server.ts`
 * and its module-scope `{ ...base }` spread. The area's config factory needs exactly this list and
 * the feature list, and reaching them through the server definition is what made the collection
 * silently lose its feature hooks when an import order changed.
 *
 * No create, no delete: a second row is not a thing.
 *
 * The order is written, not computed — see the long note in `collection/hooks.server.ts`, which
 * also says what nothing checks. An area lists fewer features than a collection (no `auth`,
 * `upload`, `nested` or `thumbnail`), so it places fewer hooks.
 */
export const areaHooks: Partial<Record<HookTiming, AnyHook[]>> = {
  beforeOperation: [authorize],

  beforeRead: [
    processDocumentFields,
    setDocumentLocale,
    setDocumentType,
    when(isVersioned, versions.exposeVersionId),
    title.setDocumentTitle,
    // After the title, for the reason the collection's list gives.
    when(hasUrl, url.populateURL)
  ],

  beforeUpdate: [
    getOriginalDocument,
    buildOriginalDocConfigMap,
    resolveContentOwner,
    when(isVersioned, versions.defineVersionOperation),
    when(isVersioned, versions.handleNewVersion),
    // Between the two, for the reasons the collection's list gives.
    metas.stampLastEditedBy,
    buildDataConfigMap,
    setDefaultValues,
    validateFields,
    when(isVersioned, versions.demoteOtherVersions)
  ]
};
