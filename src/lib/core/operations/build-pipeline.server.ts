import type { PrototypeName } from '$lib/core/prototype/registry.server.js';
import type { Dic } from '$lib/util/types.js';
import type { HookTiming } from '../features/define.js';
import { featureHooksFor } from '../features/registry.js';
import { logger } from '../logger.server.js';
import { marksOf, resolvePipeline } from './resolve-pipeline.server.js';

/** Every timing a pipeline can carry. A prototype simply declares nothing for the ones it has
 *  no use for — an area has no create or delete. */
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

type OwnHooks = Partial<Record<HookTiming, unknown[]>>;

/**
 * Composes one config's pipeline out of the three layers that contribute to it, and orders it.
 *
 * The three sources go in as one list per timing, and that list's order is only the *tie-break*
 * — `resolvePipeline` decides the rest from what each hook declares. What matters is what is not
 * here: no prototype names a feature. Before this, a collection's `beforeRead` literally read
 * `...featureHooks(upload, collection, 'beforeRead')`, so extending a prototype meant editing it.
 *
 * The tie-break order — prototype, then features in registry order, then the consumer's — is the
 * one thing chosen rather than derived, and it is chosen to be *stable*: field order is column
 * order elsewhere in this repo, so two configs declaring the same hooks must resolve the same
 * way every time.
 */
export const buildPipeline = (
  prototype: PrototypeName,
  config: Dic,
  own: OwnHooks,
  consumer: Dic | undefined
): Dic => {
  const pipeline: Dic = {};

  for (const timing of TIMINGS) {
    const hooks = [
      ...(own[timing] ?? []),
      ...featureHooksFor(prototype, config, timing),
      // A consumer's hooks are last only as a tie-break. Under the resolver they no longer land
      // unconditionally at the end: a `beforeRead` hook defaults to requiring `shaped` and
      // providing `document`, so `sortDocumentProps` now waits for it. It used to run *after*
      // the sort, leaving any property a consumer added unsorted.
      ...((consumer?.[timing] as unknown[]) ?? [])
    ];

    if (!hooks.length) {
      pipeline[timing] = [];
      continue;
    }

    // A rime-owned hook with no name makes `hooks.generated.md` unreadable exactly where it
    // matters, and the generated file is the only place the order is legible now. Consumer hooks
    // are deliberately exempt — nobody needs to identify someone else's hook in rime's own doc —
    // which is why this counts the prototype's and the features' contributions only.
    const owned = (own[timing]?.length ?? 0) + featureHooksFor(prototype, config, timing).length;
    const unnamed = hooks
      .slice(0, owned)
      .filter((hook) => marksOf(hook).name === 'anonymous').length;

    if (unnamed) {
      logger.warn(
        `${prototype} ${config.slug} ${timing}: ${unnamed} rime-owned hook(s) declare no name, ` +
          `so they appear as "anonymous" in hooks.generated.md.`
      );
    }

    pipeline[timing] = resolvePipeline({ hooks, label: `${prototype} ${config.slug} ${timing}` });
  }

  return pipeline;
};
