import type { Dic } from '$lib/util/types.js';
import type { HookTiming } from './types.js';
import type { PrototypeDefinition } from '../prototype/define.js';
import { sortDocumentProps } from './steps/sort-document-props.server.js';
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

  /**
   * Whether each feature is on for this config.
   *
   * A hook says whose it is — `feature: 'auth'` beside its name — so this is the only lookup
   * needed. It used to be a map built by walking `FeatureDefinition.hooks`, a per-timing list
   * every feature kept and every prototype had to agree with; the timing is the prototype's
   * business and the ownership is the hook's, so neither wanted to live on the feature.
   */
  const enabled = new Map(definition.features.map((f) => [f.name, f.enabled(config)]));

  for (const timing of TIMINGS) {
    const placed = definition.hooks?.[timing] ?? [];

    pipeline[timing] = [
      // The order is the list. All that is decided here is which of them this config runs: a
      // hook belonging to a feature runs only where that feature is enabled, and a hook belonging
      // to none is the prototype's own and always runs.
      ...placed.filter((hook) => {
        const owner = (hook as { feature?: string }).feature;
        return owner === undefined || enabled.get(owner) === true;
      }),
      // A consumer's hooks are appended. They cannot interleave with the placed ones, which is
      // the cost of a written order.
      ...((consumer?.[timing] as unknown[]) ?? []),
      /**
       * And then the finaliser, after everything including the consumer's.
       *
       * `sortDocumentProps` is not a participant — nothing may precede it and nothing may follow,
       * so it is appended rather than placed. In no list, because a list is for things whose
       * position is a choice.
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
  const described: Record<string, { name: string; from: string }[]> = {};

  for (const timing of TIMINGS) {
    const resolved = (buildPipeline(definition, config, config.$hooks as Dic | undefined)[timing] ??
      []) as unknown[];

    described[timing] = resolved.map((hook) => {
      return {
        name: hookName(hook),
        // A hook says whose it is; anything that says nothing is the prototype's own.
        from: (hook as { feature?: string }).feature ?? (config.type as string) ?? 'prototype'
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
