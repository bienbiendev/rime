import { IS_RIME_REPO, PACKAGE_NAME } from '$lib/core/constants.server.js';
import type { Config } from '$lib/core/factory/config/types.js';
import { withVersionsSuffix } from '$lib/core/features/versions/naming.js';
import { capitalize } from '$lib/util/string.js';

/**
 * Generate document's type name
 * @example
 * makeDocTypeName('pages')
 * // return PagesDoc
 */
const makeDocTypeName = (slug: string): string => `${capitalize(slug.replace('$', ''))}Doc`;

/**
 * Generate the document's type definition
 * @returns the full document type
 */
export const templateDocType = (slug: string, content: string, upload?: boolean): string => `
export type ${makeDocTypeName(slug)} = BaseDoc & ${upload ? 'UploadDoc & ' : ''} {
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
  const registerCollections = collections.length
    ? [
        '\tinterface RegisterCollection {',
        `${collections
          .map((collection) => {
            let collectionRegister = `\t\t'${collection.slug}': ${makeDocTypeName(collection.slug)}`;
            if (collection.versions) {
              collectionRegister += `\n\t\t'${withVersionsSuffix(collection.slug)}': ${makeDocTypeName(collection.slug)}`;
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

export const templateDeclareVirtualModule = () =>
  [
    `declare module '$rime/config' {`,
    ...(IS_RIME_REPO ? ['\t// eslint-disable-next-line no-restricted-imports'] : []),
    `\texport * from '${PACKAGE_NAME}/config/server';`,
    `}`,
    `declare module '$rime/schema' {`,
    `\texport * from '$lib/rime.schema.server.js';`,
    `}`
  ].join('\n');

export const templateLocals = (rimeConfigServerPath: string) => `declare global {
  namespace App {
    interface Locals {
			/** Flag only ON when create the first panel user */
			isInit?: boolean;
			/** The better auth session */
      session: Session | undefined;
			/** The rime user document when authenticated */
      user: User | undefined;
			/**
			 * Flag enabled when a create operation is triggered
			 * by a auth/sign-up api call.
			 */
			isAutoSignIn?: boolean;
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
			 * Current locale if applicable
			 * set following this prioroty :
			 * - locale inside the url from your front-end ex: /en/foo
			 * - locale from searchParams ex : ?locale=en
			 * - locale from cookie
			 * - default locale
			*/
      locale: string | undefined;
    }
  }
}`;
