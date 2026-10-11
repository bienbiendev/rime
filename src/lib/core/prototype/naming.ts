import { capitalize, mapSegments, toKebabCase } from '#lib/util/string.js';

/**
 * A prototype slug's URL form.
 *
 * One canonical slug produces every other representation by pure transform, so nothing here
 * knows what any particular marker means:
 *
 *   pages               ->  pages
 *   someSlug            ->  some-slug
 *   $someSlug__versions ->  some-slug--versions
 *   $someSlugDirectories->  some-slug-directories
 *
 * The `$` is dropped — it marks a slug as rime-derived for config authors, and has no business
 * in a URL. The `__` becomes `--`, keeping a segment boundary visible and distinct from the
 * word breaks around it.
 *
 * Going the other way is a lookup against the config, in `core/routes/context.server.ts`:
 * `medias-directories` is what both `$mediasDirectories` and a collection named
 * `mediasDirectories` kebab to.
 */
export const prototypeKebab = (slug: string) =>
  mapSegments(slug.replace(/^\$/, ''), toKebabCase, '--');

/**
 * The name of a document's generated type: its slug capitalized, without the `$` of a rime
 * collection, then `Doc`.
 *
 * ```ts
 * makeDocTypeName('pages'); // 'PagesDoc'
 * makeDocTypeName('$mediasDirectories'); // 'MediasDirectoriesDoc'
 * ```
 */
export const makeDocTypeName = (slug: string): string => `${capitalize(slug.replace('$', ''))}Doc`;
