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
 * The collection prototype's *own* document hooks — the ones that are its, unconditionally.
 *
 * There is no `pipeline.server.ts` any more, and its absence is the point. That file listed every
 * hook by hand, including `...featureHooks(upload, collection, 'beforeRead')` and a ternary per
 * conditional — a prototype knowing the features that extend it. Every one of those conditionals
 * turned out to be a feature gate: `collection.auth ? [...] : []` is the auth feature's `enabled`.
 *
 * **In its own file, and not in `definition.server.ts`, for one reason:** a *derived* collection
 * needs the same list. `upload` derives a `<slug>Directories` collection and `versions` derives one
 * per versioned area, and both must run authorize, validation and the rest exactly as an authored
 * collection does. Reaching them from a feature has to not close a module cycle — the definition is
 * imported by every feature already (it lists them), so a feature importing the definition *back*
 * for its hooks would put `definition.server.ts`'s `{ ...base }` spread at the mercy of which side
 * of the pair some unrelated file happened to import first. A list of hooks depends on nothing here,
 * so it is safe to import from anywhere.
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
