import { defineVersionOperation } from '$lib/core/features/versions/hooks/define-version-operation.server.js';
import { handleNewVersion } from '$lib/core/features/versions/hooks/handle-new-version.server.js';
import { authorize } from '$lib/core/pipeline/steps/authorize.server.js';
import { buildDataConfigMap } from '$lib/core/pipeline/steps/data-config-map.server.js';
import { getOriginalDocument } from '$lib/core/pipeline/steps/get-original-document.server.js';
import { buildOriginalDocConfigMap } from '$lib/core/pipeline/steps/original-config-map.server.js';
import { processDocumentFields } from '$lib/core/pipeline/steps/process-document-fields.server.js';
import { setDefaultValues } from '$lib/core/pipeline/steps/set-default-values.server.js';
import { setDocumentLocale } from '$lib/core/pipeline/steps/set-document-locale.server.js';
import { setDocumentType } from '$lib/core/pipeline/steps/set-document-type.server.js';
import { sortDocumentProps } from '$lib/core/pipeline/steps/sort-document-props.server.js';
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
 */
export const areaHooks: Partial<Record<HookTiming, AnyHook[]>> = {
  beforeOperation: [authorize],
  beforeRead: [processDocumentFields, setDocumentLocale, setDocumentType, sortDocumentProps],
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
