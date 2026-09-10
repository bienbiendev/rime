import { capitalize } from '$lib/util/string.js';

type WithAreaLabel<T> = Omit<T, 'label'> & { label: string };

/**
 * An area's label: what the author wrote, else its capitalised slug.
 *
 * The area's one own augment, and the mirror of the collection's — which normalises a string or
 * an object into `{ singular, plural }`, because a collection is named in two numbers and an area
 * in one. The kind's own statement about itself, so it belongs to the kind rather than to a
 * shared factory.
 */
export const augmentAreaLabel = <T extends { slug: string; label?: string }>(
  config: T
): WithAreaLabel<T> => ({
  ...config,
  label: config.label ? config.label : capitalize(config.slug)
});
