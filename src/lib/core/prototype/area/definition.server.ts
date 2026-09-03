import { defineVersionOperation } from '$lib/core/features/versions/hooks/define-version-operation.server.js';
import { handleNewVersion } from '$lib/core/features/versions/hooks/handle-new-version.server.js';
import { authorize } from '$lib/core/operations/steps/authorize.server.js';
import { buildDataConfigMap } from '$lib/core/operations/steps/data-config-map.server.js';
import { getOriginalDocument } from '$lib/core/operations/steps/get-original-document.server.js';
import { buildOriginalDocConfigMap } from '$lib/core/operations/steps/original-config-map.server.js';
import { processDocumentFields } from '$lib/core/operations/steps/process-document-fields.server.js';
import { setDefaultValues } from '$lib/core/operations/steps/set-default-values.server.js';
import { setDocumentLocale } from '$lib/core/operations/steps/set-document-locale.server.js';
import { setDocumentType } from '$lib/core/operations/steps/set-document-type.server.js';
import { sortDocumentProps } from '$lib/core/operations/steps/sort-document-props.server.js';
import { validateFields } from '$lib/core/operations/steps/validate-fields.server.js';
import type { BuiltArea } from '$lib/core/factory/config/types.js';
import { definePrototype } from '../define.js';
import { createBlankDocument } from '../doc.js';
import { api, type AreaAccessor } from './api.server.js';
import { area as base } from './definition.js';
import { rest } from './rest/index.server.js';

/**
 * The server half: the same area, plus `api`, `rest` and the boot step.
 *
 * `boot` is the consequence of `singleton: true`. Nothing at runtime may create the row, so it
 * has to be there already. It used to be conjured on the read path instead — `area.get` checked
 * for the row and wrote it when absent, on every read — which put a write behind a GET, cost a
 * SELECT per read forever to re-ask a question answered "yes" since the first request, and let an
 * area's creation time and locale be decided by whichever request happened to look first.
 */
export const area = definePrototype<BuiltArea, AreaAccessor>({
  ...base,

  api: (ctx) => api(ctx),

  rest,

  /**
   * The area's own document hooks. On the server half for the reason the collection's are — a
   * hook typed through `event.locals.rime` cannot sit where the config factory imports it.
   *
   * No create, no delete: a second row is not a thing.
   */
  hooks: {
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
  },

  boot: async ({ config, adapter, defaultLocale }) => {
    /**
     * No request event: boot has no request. `createBlankDocument` takes one only to pass to a
     * field's `defaultValue({ event })`, which already declares it optional — so a default that
     * reads it gets `undefined` here rather than whichever request arrived first.
     *
     * The locale is the config's default for the same reason: the locale of an area's first row
     * is a property of the config, not of its first reader.
     */
    await adapter.prototype(config.slug).ensureExists({
      blank: createBlankDocument(config),
      locale: defaultLocale
    });
  }
});
