import type { BuiltArea } from '$lib/core/config/types.js';
import { definePrototype } from '../define.js';
import { createBlankDocument } from '../doc.js';
import { api, type AreaAccessor } from './api.server.js';
import { area as base } from './definition.js';
import { areaHooks } from './hooks.server.js';
import { rest } from './rest/index.server.js';

/**
 * The server half: the same area, plus `api`, `rest` and the boot step.
 *
 * `boot` is the consequence of `singleton: true`: nothing at runtime may create the row, so it has
 * to exist before requests arrive. Doing it here keeps writes off the read path, and makes an
 * area's creation time and locale a property of the config rather than of its first reader.
 */
export const area = definePrototype<BuiltArea, AreaAccessor>({
  ...base,

  api: (ctx) => api(ctx),

  rest,

  /**
   * The area's own document hooks, listed in `hooks.server.ts` beside this file. On the server
   * half for the reason the collection's are — a hook typed through `event.locals.rime` cannot sit
   * where the config factory imports it.
   */
  hooks: areaHooks,

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
