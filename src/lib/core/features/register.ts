/**
 * How a feature declares a **document shape** into core's `Docs` registry.
 *
 * `Docs` maps a `DocType` to what a document of that type looks like, and four of its entries were
 * a feature's: `upload`, `version`, `auth` and `directory`. Core declaring them meant
 * `core/prototype/types.ts` importing `UploadPath` and `VersionsStatus` out of two features to
 * spell its own registry.
 *
 * Merged beside the feature's own types:
 *
 * ```ts
 * declare module '$lib/core/features/register.js' {
 *   interface FeatureDocTypes {
 *     version: VersionDoc;
 *   }
 * }
 * ```
 *
 * The prototype slugs come the other way, through `RegisterCollection`/`RegisterArea`, which
 * codegen writes. This is the same mechanism for the shapes a feature adds rather than a config.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FeatureDocTypes {}
