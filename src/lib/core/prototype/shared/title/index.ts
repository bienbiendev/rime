import { defineFeature } from '$lib/core/features/define.js';

/**
 * Which of a document's own fields stands in for it — `asTitle`.
 *
 * Ordered after `upload`, which `requires` states: both contribute to the same answer, and
 * upload's fallback has to be in place before this resolves it.
 */
export const title = defineFeature({
  name: 'title',
  enabled: () => true

  // The hook that reads what the augment resolved — both halves of one idea, both here. Through
  // `$rime/modules` because a hook is server-only and this file is reachable from a client build.
});

/** Resolves `asTitle`, which the built config declares as required. */
declare module '$lib/core/features/register.js' {
  interface FeatureConfigAugment<T> {
    title: T & { asTitle: string };
  }
}
