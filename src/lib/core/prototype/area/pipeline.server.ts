import type { Area, AreaHooks } from '$lib/types.js';
import { featureHooks, url } from '$lib/core/features/registry.js';
import { defineVersionOperation } from '$lib/core/features/versions/hooks/define-version-operation.server.js';
import { handleNewVersion } from '$lib/core/features/versions/hooks/handle-new-version.server.js';
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
 * Every hook rime runs on an area, and the order it runs them in.
 *
 * The same split as the collection pipeline beside it: features own the implementations and the
 * condition that enables them, this file owns the order.
 */

type PartialArea = {
  $hooks?: AreaHooks<any>;
  $url?: Area<any>['$url'];
};

/** Annotated rather than inferred, for the reason given in the collection pipeline. */
type AreaPipeline = Required<AreaHooks<any>>;

/**
 * The hooks rime contributes to an area, in order.
 *
 * An area is a single document: no create, no delete, and none of the collection-only
 * features (auth, upload, nested). Note the two deliberate differences from
 * collectionPipeline's beforeRead: populateURL runs before setDocumentType, and there is no
 * thumbnail step.
 */
export const areaPipeline = (area: PartialArea): AreaPipeline => ({
  beforeOperation: [authorize],

  beforeRead: [
    //
    processDocumentFields,
    setDocumentTitle,
    setDocumentLocale,
    ...featureHooks(url, area, 'beforeRead'),
    setDocumentType,
    sortDocumentProps
  ],

  beforeUpdate: [
    //
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

/** Same, for an area — only the four timings an area actually has. */
export const augmentAreaHooks = <T extends PartialArea>(area: T): T => {
  const hooks = areaPipeline(area);

  return {
    ...area,
    $hooks: {
      beforeOperation: [...hooks.beforeOperation, ...(area.$hooks?.beforeOperation || [])],
      beforeUpdate: [...hooks.beforeUpdate, ...(area.$hooks?.beforeUpdate || [])],
      afterUpdate: [...hooks.afterUpdate, ...(area.$hooks?.afterUpdate || [])],
      beforeRead: [...hooks.beforeRead, ...(area.$hooks?.beforeRead || [])]
    }
  };
};
