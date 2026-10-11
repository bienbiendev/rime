import type { BuiltArea } from '#lib/core/config/types.js';
import { buildConfigMap } from '#lib/core/pipeline/config-map/index.js';
import { persistRelational } from '#lib/core/pipeline/run.server.js';
import type { OperationContext } from '#lib/core/pipeline/types.js';
import { definePrototype } from '../define.js';
import { initialVersion } from '#lib/core/prototype/shared/versions/initial.js';
import { area as base } from './definition.js';
import { rest } from './rest/index.server.js';

/**
 * The server half: the same area, plus `rest` and the boot step.
 *
 * `boot` is the consequence of `singleton: true`: nothing at runtime may create the row, so it has
 * to exist before requests arrive. Doing it here keeps writes off the read path, and makes an
 * area's creation time and locale a property of the config rather than of its first reader.
 */
export const area = definePrototype<BuiltArea>({
  ...base,

  rest,

  boot: async ({ config, adapter, defaultLocale }) => {
    // A versioned area's first row is its published version, unlike a draft a create starts.
    const initial = initialVersion(config.initial(), config);
    const created = await adapter
      .area(config.slug)
      .ensureExists({ initial, locale: defaultLocale });

    // The first boot is the area's create: the blocks, tree items and relations of its initial
    // document are written with it, on the row they hang off.
    if (created) {
      const configMap = buildConfigMap(initial, config.fields);
      await persistRelational({
        context: { params: { locale: defaultLocale }, configMap } as OperationContext,
        ownerId: created.contentId,
        data: initial,
        incomingPaths: Object.keys(configMap),
        adapter,
        config,
        locale: defaultLocale
      });
    }
  }
});
