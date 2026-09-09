import * as title from '$lib/core/features/title/hooks/index.server.js';
import * as url from '$lib/core/features/url/hooks/index.server.js';
import * as versions from '$lib/core/features/versions/hooks/index.server.js';
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
import type { AnyHook, HookTiming } from '$lib/core/features/define.js';

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
 * The order is written, not computed — see the long note in `collection/hooks.server.ts`. An area
 * lists fewer features than a collection (no `auth`, `upload`, `nested` or `thumbnail`), so it
 * places fewer hooks; `buildPipeline` refuses to boot if a feature contributes one this does not.
 */
export const areaHooks: Partial<Record<HookTiming, AnyHook[]>> = {
  beforeOperation: [authorize],

  beforeRead: [
    processDocumentFields,
    setDocumentLocale,
    setDocumentType,
    versions.exposeVersionId,
    title.setDocumentTitle,
    // After the title, for the reason the collection's list gives.
    url.populateURL
  ],

  beforeUpdate: [
    getOriginalDocument,
    buildOriginalDocConfigMap,
    resolveContentOwner,
    versions.defineVersionOperation,
    versions.handleNewVersion,
    buildDataConfigMap,
    setDefaultValues,
    validateFields,
    versions.demoteOtherVersions
  ]
};
