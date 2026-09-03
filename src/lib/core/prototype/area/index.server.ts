import type { BuiltArea } from '$lib/core/factory/config/types.js';
import { definePrototype } from '../define.js';
import { createBlankDocument } from '../doc.js';
import { api, type AreaAccessor } from './api.server.js';
import { rest } from './rest/index.server.js';

/**
 * An area is a prototype with the singleton flag on: exactly one document, so create and delete
 * are off, and reads and updates need no id to say which one they mean.
 *
 * Its `boot` is the consequence of that. Nothing at runtime may create the row, so it has to be
 * there already. It used to be conjured on the read path instead — `area.get` checked for the
 * row and wrote it when absent, on every read — which put a write behind a GET, cost a SELECT
 * per read forever to re-ask a question that had been answered "yes" since the first request,
 * and let an area's creation time and locale be decided by whichever request happened to look
 * first.
 */
export const area = definePrototype<BuiltArea, AreaAccessor>({
  singleton: true,

  api: (ctx) => api(ctx),

  rest,

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
