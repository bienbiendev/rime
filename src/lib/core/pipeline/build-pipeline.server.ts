import type { Dic } from '$lib/util/types.js';
import type { HookTiming } from '../features/define.js';
import type { FeatureDefinition } from '../features/define.js';
import type { PrototypeDefinition } from '../prototype/define.js';
import { sortDocumentProps } from './steps/sort-document-props.server.js';
import { logger } from '../logger.server.js';
import { hookName } from './hook-name.server.js';

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
 * **The list order is the run order.** It used to be a tie-break, with `resolvePipeline` deciding
 * the rest from `requires`/`provides` each hook declared — see the note in
 * `prototype/collection/hooks.server.ts` for why that went.
 */
export const buildPipeline = (
  definition: Pick<PrototypeDefinition, 'features' | 'hooks'>,
  config: Dic,
  consumer: Dic | undefined
): Dic => {
  const pipeline: Dic = {};

  // Which feature owns each hook, by identity — the same lookup the pipeline chart makes. A hook
  // core owns is in no feature and is never gated.
  const ownerOf = new Map<unknown, FeatureDefinition>();
  for (const feature of definition.features) {
    for (const timing of TIMINGS) {
      for (const hook of feature.hooks?.[timing] ?? []) ownerOf.set(hook, feature);
    }
  }

  for (const timing of TIMINGS) {
    const placed = definition.hooks?.[timing] ?? [];
    const label = `${config.type} ${config.slug} ${timing}`;

    /**
     * A feature contributing a hook the prototype does not place would simply never run, and
     * nothing else would say so — the failure the written order trades for the resolver's. It is
     * the one thing worth checking at boot, and it is knowable before anything executes.
     */
    const placedSet = new Set(placed);
    for (const feature of definition.features) {
      for (const hook of feature.hooks?.[timing] ?? []) {
        if (!placedSet.has(hook)) {
          throw new Error(
            `${label}: ${feature.name} contributes "${hookName(hook)}", and the prototype's list does not place it`
          );
        }
      }
    }

    // A rime-owned hook with no name makes the generated pipeline unreadable exactly where it
    // matters. Consumer hooks are exempt — nobody needs to identify someone else's hook here.
    const unnamed = placed.filter((hook) => hookName(hook) === 'anonymous').length;
    if (unnamed) {
      logger.warn(`${label}: ${unnamed} rime-owned hook(s) declare no name.`);
    }

    pipeline[timing] = [
      // The order is the list. All that is decided here is which of them this config runs: a
      // feature's hook runs only where that feature is enabled, which is what stops a versioned
      // hook firing on a config with no versions.
      ...placed.filter((hook) => ownerOf.get(hook)?.enabled(config) ?? true),
      // A consumer's hooks are appended. They cannot interleave with the placed ones, which is
      // the cost of a written order.
      ...((consumer?.[timing] as unknown[]) ?? []),
      /**
       * And then the finaliser, after everything including the consumer's.
       *
       * `sortDocumentProps` is not a participant — nothing may precede it and nothing may follow,
       * so it is appended rather than placed. In no list, because a list is for things whose
       * position is a choice. Nine hooks used to declare a `core:document` mark for the sole
       * purpose of letting this one wait on them.
       */
      ...(timing === 'beforeRead' ? [sortDocumentProps] : [])
    ];
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
 * Read-only, and what the generated hooks chart renders; the runtime path is untouched.
 */
export const describePipeline = (
  definition: Pick<PrototypeDefinition, 'features' | 'hooks'>,
  config: Dic
): Record<string, { name: string; from: string }[]> => {
  const active = definition.features.filter((feature) => feature.enabled(config));
  const described: Record<string, { name: string; from: string }[]> = {};

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
      return {
        name: hookName(hook),
        // Anything not contributed by a feature or the config is the prototype's — including
        // the finaliser, which `buildPipeline` appends rather than reading off a list.
        from: from.get(hook) ?? config.type ?? 'prototype'
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
