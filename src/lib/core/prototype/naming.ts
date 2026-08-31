/**
 * Convert a kebab-case prototype slug.
 * Basically used to convert param matchers slug into a collection/area slug.
 * Only a literal trailing `_directories`/`_versions` suffix is preserved as a
 * suffix — everything else, including a plain `-versions`/`-directories`
 * word, is camelCased like any other segment.
 *
 * @example
 * prototypeKebabToSlug('my-collection') // returns 'myCollection'
 * prototypeKebabToSlug('my-collection_directories') // returns 'myCollection_directories'
 * prototypeKebabToSlug('my-collection_versions') // returns 'myCollection_versions'
 * prototypeKebabToSlug('my-collection-versions') // returns 'myCollectionVersions'
 */
export const prototypeKebabToSlug = (kebab: string) => {
  const suffixMatch = kebab.match(/(_(?:directories|versions))$/);
  const suffix = suffixMatch ? suffixMatch[1] : '';
  const base = suffix ? kebab.slice(0, -suffix.length) : kebab;

  return base.replace(/-([a-z])/g, (_, char) => char.toUpperCase()) + suffix;
};
