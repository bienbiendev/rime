import { authorize } from '$lib/core/operations/hooks/before-operation/authorize.server.js';
import { populateURL } from '$lib/core/operations/hooks/before-read/populate-url.server.js';
import { processDocumentFields } from '$lib/core/operations/hooks/before-read/process-document-fields.server.js';
import { setDocumentLocale } from '$lib/core/operations/hooks/before-read/set-document-locale.server.js';
import { setDocumentTitle } from '$lib/core/operations/hooks/before-read/set-document-title.server.js';
import { setDocumentType } from '$lib/core/operations/hooks/before-read/set-document-type.server.js';
import { sortDocumentProps } from '$lib/core/operations/hooks/before-read/sort-document-props.server.js';
import { defineVersionOperation } from '$lib/core/operations/hooks/before-update/define-version-operation.server.js';
import { getOriginalDocument } from '$lib/core/operations/hooks/before-update/get-original-document.server.js';
import { buildDataConfigMap } from '$lib/core/operations/hooks/before-upsert/data-config-map.server.js';
import { handleNewVersion } from '$lib/core/operations/hooks/before-upsert/handle-new-version.server.js';
import { buildOriginalDocConfigMap } from '$lib/core/operations/hooks/before-upsert/original-config-map.server.js';
import { setDefaultValues } from '$lib/core/operations/hooks/before-upsert/set-default-values.server.js';
import { validateFields } from '$lib/core/operations/hooks/before-upsert/validate-fields.server.js';
import type { Area, AreaHooks } from '../../../types.js';

type PartialConfig = {
  $hooks?: AreaHooks<any>;
  $url?: Area<any>['$url'];
};

/**
 * Augment an area config with hooks
 */
export const augmentHooks = <T extends PartialConfig>(area: T): T => {
  const hooks = {
    beforeOperation: [authorize],

    beforeRead: [
      //
      processDocumentFields,
      setDocumentTitle,
      setDocumentLocale,
      ...(area.$url ? [populateURL] : []),
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
  };

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
