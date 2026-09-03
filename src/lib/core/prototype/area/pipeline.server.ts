import type { AreaHooks } from '$lib/types.js';
import { defineVersionOperation } from '$lib/core/features/versions/hooks/define-version-operation.server.js';
import { handleNewVersion } from '$lib/core/features/versions/hooks/handle-new-version.server.js';
import { buildPipeline } from '$lib/core/operations/build-pipeline.server.js';
import { authorize } from '$lib/core/operations/steps/authorize.server.js';
import { buildDataConfigMap } from '$lib/core/operations/steps/data-config-map.server.js';
import { getOriginalDocument } from '$lib/core/operations/steps/get-original-document.server.js';
import { buildOriginalDocConfigMap } from '$lib/core/operations/steps/original-config-map.server.js';
import { processDocumentFields } from '$lib/core/operations/steps/process-document-fields.server.js';
import { setDefaultValues } from '$lib/core/operations/steps/set-default-values.server.js';
import { setDocumentLocale } from '$lib/core/operations/steps/set-document-locale.server.js';
import { setDocumentTitle } from '$lib/core/operations/steps/set-document-title.server.js';
import { setDocumentType } from '$lib/core/operations/steps/set-document-type.server.js';
import { sortDocumentProps } from '$lib/core/operations/steps/sort-document-props.server.js';
import { validateFields } from '$lib/core/operations/steps/validate-fields.server.js';

/**
 * The hooks an area contributes to its own pipeline.
 *
 * The same split as the collection's, and the same silence about features. An area is a single
 * document: no create, no delete, and no thumbnail step — it simply declares nothing for the
 * timings it has no use for.
 */
const ownHooks = () => ({
  beforeOperation: [authorize],

  beforeRead: [
    processDocumentFields,
    setDocumentTitle,
    setDocumentLocale,
    setDocumentType,
    sortDocumentProps
  ],

  beforeUpdate: [
    defineVersionOperation,
    getOriginalDocument,
    buildOriginalDocConfigMap,
    handleNewVersion,
    buildDataConfigMap,
    setDefaultValues,
    validateFields
  ],

  afterUpdate: []
});

/** Only what the area's own hooks read — `$url` is the url feature's business, not the area's. */
type PartialArea = {
  slug?: string;
  $hooks?: AreaHooks<any>;
};

/** The area's own hooks, whatever the registry's features contribute, and the consumer's —
 *  merged and ordered. */
export const augmentAreaHooks = <T extends PartialArea>(area: T): T => ({
  ...area,
  $hooks: buildPipeline('area', area, ownHooks(), area.$hooks)
});
