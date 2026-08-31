import {
  areaPipeline,
  collectionPipeline,
  directoriesPipeline
} from '$lib/core/operations/pipeline.server.js';
import { expect, test } from 'vitest';
import { uploadRuntime } from './upload/runtime.server.js';
import { urlRuntime } from './url/runtime.server.js';
import { versionsRuntime } from './versions/runtime.server.js';

/**
 * Guards the other half of the feature/pipeline contract.
 *
 * A feature declares hooks; operations/pipeline.server.ts places them. Two things can go wrong,
 * and the type system only catches one:
 *
 * - **Wrong timing** — placing a `beforeRead` hook in the `afterDelete` array. Caught at compile
 *   time, but only since the pipelines annotate their return as `Required<CollectionHooks>` and
 *   features key `hooks` by timing. Both were added together; before that, a misplaced hook
 *   produced no error anywhere.
 * - **Never placed** — a feature exports a hook the pipeline forgets to mention. Nothing catches
 *   that, ever: the hook simply never runs, and the feature looks complete. That is what this
 *   file is for.
 *
 * It deliberately checks identity, not names: a hook renamed in the feature but not in the
 * pipeline is a compile error already, whereas a hook quietly dropped from a pipeline array is
 * not.
 */

/** Every hook rime places, for a prototype with every convertible feature switched on. */
const placedHooks = (() => {
  const placed = new Set<unknown>();
  const collect = (pipeline: Record<string, unknown[]>) =>
    Object.values(pipeline)
      .flat()
      .forEach((hook) => placed.add(hook));

  collect(
    collectionPipeline({
      upload: {},
      nested: true,
      auth: { type: 'password' },
      $url: () => '/'
    } as any) as any
  );
  collect(areaPipeline({ $url: () => '/' } as any) as any);
  // The derived <slug>_directories collection has a pipeline of its own — three upload hooks
  // run only there, so omitting it would report them as unplaced.
  collect(directoriesPipeline(undefined) as any);

  return placed;
})();

/** [featureName, timing, hookName, fn] for every hook every converted feature declares. */
const declaredHooks = [uploadRuntime, urlRuntime, versionsRuntime].flatMap((feature) =>
  Object.entries(feature.hooks as Record<string, Record<string, unknown>>).flatMap(
    ([timing, hooks]) =>
      Object.entries(hooks).map(
        ([hookName, fn]) => [feature.name, timing, hookName, fn] as const
      )
  )
);

test('every hook a feature declares is placed in a pipeline', () => {
  const unplaced = declaredHooks
    .filter(([, , , fn]) => !placedHooks.has(fn))
    .map(([feature, timing, hookName]) => `${feature}.hooks.${timing}.${hookName}`);

  expect(unplaced).toEqual([]);
});

test('the features under contract actually declare hooks', () => {
  // Cheap canary: if a refactor empties the maps, the test above passes vacuously.
  expect(declaredHooks.length).toBe(11);
});
