import type { Dic } from '$lib/util/types.js';
import type { HookTiming } from '../features/define.js';
import type { PrototypeDefinition } from '../prototype/define.js';
import { logger } from '../logger.server.js';
import { marksOf, resolvePipeline } from './resolve-pipeline.server.js';

/** Every timing a pipeline can carry. A prototype declares nothing for the ones it has no use
 *  for — an area has no create or delete. */
const TIMINGS: HookTiming[] = [
  'beforeOperation',
  'beforeRead',
  'beforeCreate',
  'afterCreate',
  'beforeUpdate',
  'afterUpdate',
  'beforeDelete',
  'afterDelete'
];

/**
 * Composes one config's pipeline out of the two layers that contribute to it, and orders it.
 *
 * Both come off the definition: its own `hooks`, then each feature it lists, for the features this
 * config enables. There is no third place, so nothing has to know both a prototype and the
 * features extending it.
 *
 * The list order is only the *tie-break*; `resolvePipeline` decides the rest from what each hook
 * declares. That it is stable still matters — field order is column order elsewhere in this repo.
 */
export const buildPipeline = (
  definition: Pick<PrototypeDefinition, 'features' | 'hooks'>,
  config: Dic,
  consumer: Dic | undefined
): Dic => {
  const pipeline: Dic = {};
  const active = definition.features.filter((feature) => feature.enabled(config));

  for (const timing of TIMINGS) {
    const own = definition.hooks?.[timing] ?? [];
    const fromFeatures = active.flatMap((feature) => feature.hooks?.[timing] ?? []);
    const hooks = [
      ...own,
      ...fromFeatures,
      // A consumer's hooks are last only as a tie-break — the resolver may place them earlier. A
      // `beforeRead` hook defaults to requiring `shaped` and providing `document`, so
      // `sortDocumentProps` waits for it.
      ...((consumer?.[timing] as unknown[]) ?? [])
    ];

    if (!hooks.length) {
      pipeline[timing] = [];
      continue;
    }

    // A rime-owned hook with no name makes the generated pipeline unreadable exactly where it
    // matters. Consumer hooks are exempt — nobody needs to identify someone else's hook here.
    const unnamed = hooks
      .slice(0, own.length + fromFeatures.length)
      .filter((hook) => marksOf(hook).name === 'anonymous').length;

    if (unnamed) {
      logger.warn(
        `${config.type} ${config.slug} ${timing}: ${unnamed} rime-owned hook(s) declare no name.`
      );
    }

    pipeline[timing] = resolvePipeline({
      hooks,
      label: `${config.type} ${config.slug} ${timing}`
    });
  }

  return pipeline;
};

/**
 * Resolves a config's pipeline into its `$hooks`, from the three lists that feed it: the
 * prototype's own hooks, the hooks of the features this config enables, and whatever the author
 * wrote there.
 *
 * Called once per prototype config, from `prototype/pipelines.server.ts`, as the last step of the
 * config chain — so `$hooks` is the authored hooks going in and the pipeline coming out, and
 * nothing anywhere holds a second copy.
 */
export const augmentHooks = <T extends Dic>(
  definition: Pick<PrototypeDefinition, 'features' | 'hooks'>,
  config: T
): T & { $hooks: Dic } => ({
  ...config,
  $hooks: buildPipeline(definition, config, config.$hooks as Dic | undefined)
});
