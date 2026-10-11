import type { Config } from '#lib/core/config/types.js';
import { IS_RIME_REPO, PACKAGE_NAME } from '#lib/core/constants.server.js';
import { makeDocTypeName } from '#lib/core/prototype/naming.js';

/**
 * Generate the document's type definition
 * @returns the full document type
 */
export const templateDocType = (
  slug: string,
  content: string,
  extendsTypes: string[] = []
): string => `
export type ${makeDocTypeName(slug)} = BaseDoc & ${extendsTypes.map((name) => `${name} & `).join('')} {
  ${content};
	[x: string]: unknown;
}`;

/**
 * Generates the module declaration for registering document types
 * @returns A string containing the module declaration for type registration
 */
export const templateRegister = <T extends Config>(config: T): string => {
  const collections = (config.collections || []).filter((c) => c._generateTypes !== false);
  const areas = (config.areas || []).filter((c) => c._generateTypes !== false);

  /**
   * The slug a config's content lives under, when a feature gives it a second table.
   *
   * A versions collection is registered as a collection in its own right but carries
   * `_generateTypes: false`, because it has no doc type of its own — it shares its parent's. So
   * it is filtered out above and its `RegisterCollection` entry added back here, pointing at the
   * parent's type.
   *
   * Collections only: a versions table is registered as a collection in its own right, and this map is
   * read nowhere but in `RegisterCollection` below.
   */
  const versionsSlugs = new Map((config.collections ?? []).map((c) => [c.slug, c._versions?.slug]));

  const registerCollections = collections.length
    ? [
        '\tinterface RegisterCollection {',
        `${collections
          .map((collection) => {
            let collectionRegister = `\t\t'${collection.slug}': ${makeDocTypeName(collection.slug)}`;
            const versionsSlug = versionsSlugs.get(collection.slug);
            if (versionsSlug) {
              collectionRegister += `\n\t\t'${versionsSlug}': ${makeDocTypeName(collection.slug)}`;
            }
            return collectionRegister;
          })
          .join('\n')};`,
        '\t}'
      ]
    : [];
  const registerAreas = areas.length
    ? [
        '\tinterface RegisterArea {',
        `${areas
          .map((area) => {
            const areaRegister = `\t\t'${area.slug}': ${makeDocTypeName(area.slug)}`;
            return areaRegister;
          })
          .join('\n')};`,
        '\t}'
      ]
    : [];
  return ["declare module 'rimecms' {", ...registerCollections, ...registerAreas, '}'].join('\n');
};

/** `schemaSpecifier` is the generated schema's `#lib/...` specifier, null when the schema lives
 * outside src/lib: an ambient declaration has no other way to reach it, so it is left out. */
export const templateDeclareVirtualModule = (schemaSpecifier: string | null) =>
  [
    `declare module '$rime/config' {`,
    ...(IS_RIME_REPO ? ['\t// eslint-disable-next-line no-restricted-imports'] : []),
    `\texport * from '${PACKAGE_NAME}/config/server';`,
    `}`,
    ...(schemaSpecifier
      ? [`declare module '$rime/schema' {`, `\texport * from '${schemaSpecifier}';`, `}`]
      : [])
  ].join('\n');

export const templateLocals = (rimeConfigServerPath: string) => `declare global {
  namespace App {
    interface Locals {
			/** Flag only ON when creating the first panel user */
			isInit?: boolean;
			/** The better auth session */
      session: Session | undefined;
			/** The rime user document when authenticated */
      user: User | undefined;
			/**
			 * Flag enabled when a create operation is triggered
			 * by an auth/sign-up api call.
			 */
			pendingSignInAfterSignUp?: boolean;
			/** The full better-auth user */
			betterAuthUser:
			| {
					id: string;
					name: string;
					email: string;
					emailVerified: boolean;
					createdAt: Date;
					updatedAt: Date;
					role?: string | null | undefined;
					banned: boolean | null | undefined;
					banReason?: string | null | undefined;
					banExpires?: Date | null | undefined;
					type: string;
				}
			| undefined;
			/** Singleton providing access to auth, config and the local API */
      rime: ReturnType<
				Awaited<
					typeof import('${rimeConfigServerPath}').default
				>['createRimeContext']
			>;
      /** Flag enabled by the core plugin rime.cache when the API cache is ON */
      cacheEnabled: boolean;
      /** Available in panel, nav routes for sidebar */
      navigation: Navigation;
      /** Dispatch facade backing the fixed /panel/[slug]/... and /api/[slug]/... routes */
      routes: RouteHandlers;
			/**
			 * The request's locale: the first code the config lists among those the request's
			 * surface names, else the default locale (undefined without localization).
			 * - /api: ?locale=en
			 * - the panel: ?locale=en, then its rime.locale cookie
			 * - the site: the route param locale, ex: [[locale=locale]] in /en/foo
			 * A hook or a load sets another with rime.setLocale().
			 */
      locale: string | undefined;
    }
  }
}`;
