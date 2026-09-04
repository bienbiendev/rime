import { defineVersionOperation } from '$lib/core/features/versions/hooks/define-version-operation.server.js';
import { handleNewVersion } from '$lib/core/features/versions/hooks/handle-new-version.server.js';
import type { AnyHook, HookTiming } from '$lib/core/features/define.js';
import { authorize } from '$lib/core/pipeline/steps/authorize.server.js';
import { buildDataConfigMap } from '$lib/core/pipeline/steps/data-config-map.server.js';
import { getOriginalDocument } from '$lib/core/pipeline/steps/get-original-document.server.js';
import { mergeWithBlankDocument } from './hooks/merge-with-blank.server.js';
import { buildOriginalDocConfigMap } from '$lib/core/pipeline/steps/original-config-map.server.js';
import { processDocumentFields } from '$lib/core/pipeline/steps/process-document-fields.server.js';
import { setDefaultValues } from '$lib/core/pipeline/steps/set-default-values.server.js';
import { setDocumentLocale } from '$lib/core/pipeline/steps/set-document-locale.server.js';
import { setDocumentType } from '$lib/core/pipeline/steps/set-document-type.server.js';
import { sortDocumentProps } from '$lib/core/pipeline/steps/sort-document-props.server.js';
import { validateFields } from '$lib/core/pipeline/steps/validate-fields.server.js';

/**
 * The collection prototype's *own* document hooks: the ones that are its, unconditionally.
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
  beforeRead: [processDocumentFields, setDocumentLocale, setDocumentType, sortDocumentProps],
  beforeCreate: [mergeWithBlankDocument, buildDataConfigMap, setDefaultValues, validateFields],
  beforeUpdate: [
    defineVersionOperation,
    getOriginalDocument,
    buildOriginalDocConfigMap,
    handleNewVersion,
    buildDataConfigMap,
    setDefaultValues,
    validateFields
  ]
};
