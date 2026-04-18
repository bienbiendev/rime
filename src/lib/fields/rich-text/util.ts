import type { RichTextFeature } from '$lib/types.js';

/**
 * Check that in given features at least one has a suggestion
 */
export function hasSuggestion(features: RichTextFeature[]) {
  return !!features.filter((feature) => {
    return (
      feature.marks?.some((mark) => !!mark.suggestion) ||
      feature.nodes?.some((node) => !!node.suggestion)
    );
  }).length;
}
