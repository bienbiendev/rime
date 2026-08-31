import {
  areaPipeline,
  collectionPipeline,
  directoriesPipeline
} from '$lib/core/operations/pipeline.server.js';
import { expect, test } from 'vitest';
import * as uploadHooks from './upload/hooks/index.server.js';
import * as urlHooks from './url/hooks/index.server.js';
import * as versionsHooks from './versions/hooks/index.server.js';

/**
 * A hook a feature exports but no pipeline ever places simply never runs, and nothing else
 * notices: the feature looks complete, the tests pass, the behaviour is missing.
 *
 * The sibling failure — placing a hook at a timing its signature does not allow — is a compile
 * error, but only since `collectionPipeline`/`areaPipeline` annotate their return as
 * `Required<CollectionHooks<any>>` / `Required<AreaHooks<any>>`. Those types always described
 * every timing correctly; the pipelines returned an inferred object literal, so nothing was
 * compared against them, and a `beforeRead` hook sat in `afterDelete` without complaint.
 *
 * This file covers the half types cannot. It checks identity rather than names — a renamed hook
 * is already a compile error, a silently dropped one is not.
 *
 * `auth` is not covered: several of its hooks are placed conditionally on the auth *type*
 * (`populateAPIKey` only for `apiKey` collections), so "declared but unplaced" is not a
 * well-defined question for it without enumerating auth configs too.
 */

/** Every hook rime places, for prototypes with the relevant features switched on. */
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
      $url: () => '/',
      versions: true
    } as any) as any
  );
  collect(areaPipeline({ $url: () => '/', versions: true } as any) as any);
  // The derived <slug>_directories collection has a pipeline of its own — three upload hooks
  // run only there, so omitting it would report them as unplaced.
  collect(directoriesPipeline(undefined) as any);

  return placed;
})();

const declaredHooks = (
  [
    ['upload', uploadHooks],
    ['url', urlHooks],
    ['versions', versionsHooks]
  ] as const
).flatMap(([feature, barrel]) =>
  Object.entries(barrel).map(([hookName, fn]) => [feature, hookName, fn] as const)
);

test('every hook these features export is placed in a pipeline', () => {
  const unplaced = declaredHooks
    .filter(([, , fn]) => !placedHooks.has(fn))
    .map(([feature, hookName]) => `${feature}/hooks: ${hookName}`);

  expect(unplaced).toEqual([]);
});

test('the hook barrels are not empty', () => {
  // Cheap canary: if a refactor empties a barrel, the test above passes vacuously.
  expect(declaredHooks.length).toBe(11);
});
