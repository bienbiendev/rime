import { defineFeature } from '../define.js';
import { setDocumentTitle } from './hooks/set-document-title.server.js';
import { augmentTitle } from './augment.js';

/**
 * Which of a document's own fields stands in for it — `asTitle`.
 *
 * Ordered after `upload`, and `requires` says so rather than leaving it to the barrel: both
 * contribute to the same answer, and the fallback has to be in place before this resolves it.
 * That is the first real use of `requires` in the registry — until now every feature required
 * nothing of any other.
 */
export const title = defineFeature({
  name: 'title',
  type: 'augment',
  requires: ['upload'],
  enabled: () => true,
  augment: augmentTitle,

  // The hook that reads what the augment resolved. Both halves of one idea, so both live here -
  // in ./hooks/, where the feature's own code is, rather than in the shared pipeline/steps/ the
  // prototype's pipeline used to reach it through.
  hooks: { beforeRead: [setDocumentTitle] }
});

/** Resolves `asTitle`, which the built config declares as required. */
declare module '$lib/core/features/register.js' {
  interface FeatureConfigAugment<T> {
    title: T & { asTitle: string };
  }
}
