import type { Dic } from '$lib/util/types.js';
import { protos, prototypeNames } from '../prototype/index.js';
import { prototypeHooks } from '../prototype/hooks.server.js';
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
 */
export const resolvePipelines = <T extends Dic>(config: T): T =>
  prototypeNames.reduce((current, name) => {
    const key = protos[name].configKey;
    const configs = (current[key] as Dic[] | undefined) ?? [];

    return {
      ...current,
      [key]: configs.map((prototypeConfig) =>
        augmentHooks(
          { features: protos[name].features, hooks: prototypeHooks[name] },
          prototypeConfig
        )
      )
    };
  }, config as Dic) as T;
