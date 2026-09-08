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
/**
 * The same composition as `buildPipeline`, but keeping what it throws away: where each hook came
 * from.
 *
 * `buildPipeline` folds three lists into one and the result is just functions, so nothing
 * downstream can say whether `handleNewVersion` is the prototype's or a feature's — which is
 * exactly the question you have when a hook lands somewhere surprising, or when you are asking
 * whether removing a feature would take its hooks with it.
 *
 * Read-only and used by `bun run rime:pipeline`; the runtime path is untouched.
 */
export const describePipeline = (
  definition: Pick<PrototypeDefinition, 'features' | 'hooks'>,
  config: Dic
): Record<string, { name: string; from: string; requires: string[]; provides: string[] }[]> => {
  const active = definition.features.filter((feature) => feature.enabled(config));
  const described: Record<
    string,
    { name: string; from: string; requires: string[]; provides: string[] }[]
  > = {};

  for (const timing of TIMINGS) {
    // Who contributed each hook, by identity — the same function object comes out of the resolver.
    const from = new Map<unknown, string>();
    for (const hook of definition.hooks?.[timing] ?? []) from.set(hook, config.type ?? 'prototype');
    for (const feature of active)
      for (const hook of feature.hooks?.[timing] ?? []) from.set(hook, feature.name);
    for (const hook of (config.$hooks?.[timing] as unknown[]) ?? [])
      from.set(hook, 'config.$hooks');

    const resolved = (buildPipeline(definition, config, config.$hooks as Dic | undefined)[timing] ??
      []) as unknown[];

    described[timing] = resolved.map((hook) => {
      const marks = marksOf(hook as never);
      return {
        name: marks.name,
        from: from.get(hook) ?? '?',
        requires: [...marks.requires],
        provides: [...marks.provides]
      };
    });
  }

  return described;
};

export const augmentHooks = <T extends Dic>(
  definition: Pick<PrototypeDefinition, 'features' | 'hooks'>,
  config: T
): T & { $hooks: Dic } => ({
  ...config,
  $hooks: buildPipeline(definition, config, config.$hooks as Dic | undefined)
});
