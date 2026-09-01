import { mapSegments, toKebabCase } from '$lib/util/string.js';

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
 * This replaced a `prototypeKebabToSlug` that matched `/(_(?:directories|versions))$/` — core
 * hardcoding two features' suffixes. Going the other way is now a lookup against the config
 * rather than an inverse transform (see handlers/routes.server.ts), which is both exact and
 * feature-agnostic: `medias-directories` cannot be reversed by rule, since it is indistinguishable
 * from a user collection named `mediasDirectories`.
 */
export const prototypeKebab = (slug: string) =>
  mapSegments(slug.replace(/^\$/, ''), toKebabCase, '--');
