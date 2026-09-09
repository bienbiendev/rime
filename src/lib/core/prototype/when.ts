import type { Dic } from '$lib/util/types.js';

/**
 * Guards a step with the question that decides whether it applies.
 *
 * ```ts
 * augments: [augmentLabel, when(isAuth, augmentAuth), augmentTitle]
 * ```
 *
 * This was `FeatureDefinition.enabled`: a predicate on a definition, folded by `applyAugments`
 * over a `features` list, so reading a prototype's augment chain meant opening ten other files to
 * find out which of them ran. The guard is beside the step it guards now, and a step with no
 * guard runs always — which is what six of the ten features declared anyway.
 *
 * The step must return what it was handed when it does not apply, which is what makes this a
 * `reduce`-able chain rather than a filter.
 */
export const when =
  <T extends Dic>(applies: (config: any) => boolean, step: (config: T) => T) =>
  (config: T): T =>
    applies(config) ? step(config) : config;
