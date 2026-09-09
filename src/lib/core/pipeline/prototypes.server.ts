import type { PrototypeDefinition } from '$lib/core/prototype/define.js';
import type { Dic } from '$lib/util/types.js';
import { area } from '../prototype/area/index.js';
import { areaHooks } from '../prototype/area/hooks.server.js';
import { collection } from '../prototype/collection/index.js';
import { collectionHooks } from '../prototype/collection/hooks.server.js';
import { augmentHooks } from './build-pipeline.server.js';

/**
 * Resolves every prototype config's pipeline, once the whole config exists.
 *
 * The **last** step of the config chain, and the only place a pipeline is built. By the time it
 * runs, the features have derived whatever they derive — upload's `<slug>Directories`, versions'
 * shadows — so a derived config is resolved by the same line as an authored one, from the same
 * three inputs: the prototype's own hooks, the hooks of the features this config enables, and the
 * author's `$hooks`.
 *
 * That is why nothing carries a second copy of anything: a config derived before this runs never
 * has a pipeline to inherit, and never needs one rebuilt.
 *
 * Each prototype's `features` comes off its **isomorphic** half and its hooks from the
 * `hooks.server.ts` beside it — never through `definition.server.ts`, which spreads `{ ...base }`
 * at module scope. See rule 3 in CONTRIBUTING.md; the failure has no symptom but a missing title.
 */
export const resolvePipelines = <T extends Dic>(config: T): T => {
  const resolve = (
    definition: Pick<PrototypeDefinition, 'features' | 'hooks'>,
    configs: unknown
  ): Dic[] => ((configs as Dic[] | undefined) ?? []).map((c) => augmentHooks(definition, c));

  return {
    ...config,
    collections: resolve(
      { features: collection.features, hooks: collectionHooks },
      config.collections
    ),
    areas: resolve({ features: area.features, hooks: areaHooks }, config.areas)
  } as T;
};
