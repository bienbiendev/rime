import type { Adapter } from '$lib/adapter-sqlite/index.server.js';
import type { PanelLanguage } from '$lib/core/i18n/index.js';
import type { Hook, HookBeforeOperation } from '$lib/core/operations/hooks/index.server.js';
import type { Plugin, PluginClient } from '$lib/core/plugins/index.js';
import type { SMTPConfig } from '$lib/core/plugins/mailer/index.server.js';
import type { Field, Option } from '$lib/fields/types.js';
import type { RegisterArea, RegisterCollection } from '$lib/index.js';
import type { DashboardEntry } from '$lib/panel/pages/dashboard/types.js';
import type { AreaSlug, CollectionSlug, User } from '$lib/types.js';
import type { AtLeastOne, Dic, WithRequired } from '$lib/util/types.js';
import type { IconProps } from '@lucide/svelte';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import type { Component } from 'svelte';
import type { FieldBuilder } from '../fields/builders/index.js';
import type { BaseDoc, DocType } from '../types/doc.js';

export interface Config {
	/** If config.siteUrl is defined, a preview button is added
	on the panel dahsboard, pointing to this url  */
	siteUrl?: string;
	/**
	 * Database adapter
	 * @example
	 * export default rime({
	 *   $adapter: adapterSqlite(drizzleConfig)
	 * }
	 */
	$adapter: {
		createAdapter: (config: any) => Promise<Adapter>;
		generateSchema: (config: any) => Promise<void>;
	};
	/** Transversal auth config */
	$auth?: {
		plugins: any;
		// configure?: AuthConfigure;
		// configurePlugins?: (...args: any[]) => any;
	};
	/** List of Collection  */
	collections?: BuiltCollection[];
	/** List of Area  */
	areas?: BuiltArea[];
	/** List of locales for document i18£n
	 * @example
	 * localization: {
	 *   locales: [
	 *     {
	 *       code: 'fr',
	 *       label: 'Français'
	 *     },
	 *     {
	 *       code: 'en',
	 *       label: 'English',
	 *     }
	 *   ],
	 *   default: 'en'
	 * }
	 * ```
	 */
	localization?: LocalizationConfig;
	/** Define wich hosts are allowed to query the API
	 *
	 * @example
	 * ```typescript
	 * trustedOrigins: ['www.external.com']
	 * ```
	 */
	$trustedOrigins?: string[];
	/** Additional panel users config  */
	staff?: AdditionalStaffConfig;
	panel?: PanelConfig;
	/** Enable built-in API cache */
	$cache?: CacheConfig;
	/** SMTP config */
	$smtp?: SMTPConfig;
	/** Custom API routes
	 * @example
	 * routes: {
	 * 	'/hello' : {
	 * 		GET: (event) => json({ message: 'hello' }),
	 * 		POST: (event) => sayHello(event).then(() => json({ message: 'Successfully said hello' })),
	 * 	}
	 * }
	 */
	$routes?: Record<string, RouteConfig>;
	/** List of client plugins */
	plugins?: PluginClient[];
	/** List of server plugins */
	$plugins?: Plugin[];
	/** Custom object for server-only config additional values  */
	$custom?: Record<string, any>;
	/** Custom object for both client and server config additional values  */
	custom?: Record<string, any>;
}

type AccessOptions = {
	id?: string;
	event?: RequestEvent;
};

export type Access = {
	create?: (user: User | undefined, options: AccessOptions) => boolean;
	read?: (user: User | undefined, options: AccessOptions) => boolean;
	update?: (user: User | undefined, options: AccessOptions) => boolean;
	delete?: (user: User | undefined, options: AccessOptions) => boolean;
};

export type AdditionalStaffConfig = {
	roles?: (string | Option)[];
	panel?: {
		group?: string;
	};
	access?: Access;
	label?: CollectionLabel;
	fields?: FieldBuilder<Field>[];
};

export type PanelConfig = {
	/** who can accesss the panel */
	$access?: (user: User | undefined) => boolean;
	/** Custom panel routes that render a given component */
	routes?: Record<string, CustomPanelRoute>;
	/** The panel language, "en" or "fr" supports only */
	language?: PanelLanguage;
	/** Sidebar navigation groups labels and icons */
	navigation?: NavigationConfig;
	/** Specific components */
	components?: {
		/** Dashboard header */
		header?: Component[];
		/** Collection header */
		collectionHeader?: Component[];
		/** Full dashboard component */
		dashboard?: Component<{ entries: DashboardEntry[]; user?: User }>;
	};
	/** a relative path from the "static" directory or an external url
	 * @example
	 * // for static/panel/custom.css
	 * css : '/panel/custom.css'
	 */
	css?: string;
};

export type CacheConfig = { isEnabled?: (event: RequestEvent) => boolean };

export type RouteConfig = {
	POST?: RequestHandler;
	GET?: RequestHandler;
	PATCH?: RequestHandler;
	DELETE?: RequestHandler;
};

export type LocalizationConfig = {
	locales: LocaleConfig[];
	default: string;
};

export type LocaleConfig = {
	code: string;
	label: string;
};

export type CollectionLabel = {
	singular: string;
	plural: string;
	/** Label to search document, ex: Search for pages... */
	search?: string;
	/** Label for creation ex: New page */
	create?: string;
	/** Label when no document found, ex: No pages found */
	none?: string;
};

export type VersionsConfig = { draft?: boolean; autoSave?: boolean; maxVersions?: number };
export type UrlDefinition<T extends BaseDoc = BaseDoc> = (document: T) => string;

export type PrototypePanelConfig = {
	/** Description for the collection/area, basically displayed on the dashboard */
	description?: string;
	/** Sidebar navigation group */
	group?: string;
};

type PrototypeConfig<S extends string = string> = {
	slug: S;
	/** Document fields definition */
	fields?: FieldBuilder<Field>[];
	/** Optional icon */
	icon?: Component<IconProps>;
	/** Enable document versions */
	versions?: boolean | VersionsConfig;
	access?: Access;
	/** If the document can be edited live, if enabled the url prop must be set also. */
	live?: boolean;
	/** Panel configuration, set false to hide the area/collection from the panel */
	panel?: false | PrototypePanelConfig;
};

export type UploadConfig = {
	/**
	 * Define image sizes that will be generated when an image is uploaded.
	 * A 'thumbnail' size will be added, if none provided with this name.
	 * @example
	 * ```typescript
	 * imageSizes: [
	 *   {
	 *     name: 'thumbnail',
	 *     width: 200,
	 *     height: 200,
	 *     out: ['jpg', 'webp'],
	 *     compression: 80
	 *   },
	 *   {
	 *     name: 'medium',
	 *     width: 800,
	 *     compression: 85
	 *   }
	 * ]
	 * ```
	 */
	imageSizes?: ImageSizesConfig[];
	/**
	 * Allowed mimeTypes
	 * @example
	 * ```typescript
	 * accept: ['image/jpeg', 'image/svg']
	 * ```
	 */
	accept?: string[];
};

export type CollectionAuthConfig = (
	| {
			type: 'password';
	  }
	| { type: 'apiKey' }
) & {
	roles?: (string | Option)[];
};

export type Collection<S> = {
	slug: S;
	/** The collection label */
	label?: string | CollectionLabel;
	/** Auth type and availables roles */
	auth?: boolean | CollectionAuthConfig;
	/** Operation hooks */
	$hooks?: CollectionHooks<S extends keyof RegisterCollection ? S : any>;
	/** A function to generate the document URL */
	$url?: (doc: S extends keyof RegisterCollection ? RegisterCollection[S] : any) => string;
	/** Whether a document can have children/parent */
	nested?: boolean;
	/** Whether the collection support file upload */
	upload?: boolean | UploadConfig;
} & PrototypeConfig;

export type Area<S> = PrototypeConfig & {
	slug: S;
	/** A function to generate the document URL */
	$url?: (doc: S extends keyof RegisterArea ? RegisterArea[S] : any) => string;
	$hooks?: AreaHooks<S extends keyof RegisterArea ? S : any>;
	/** The area label */
	label?: string;
};

type NavigationConfig = { groups: Array<{ label: string; icon: Component<IconProps> }> };

export type CustomPanelRoute = {
	group?: string;
	label: string;
	icon?: Component<IconProps>;
	component: Component;
};

export type ImageSizesConfig = {
	name: string;
	/** If none provided, will fallback to original file extesion */
	out?: Array<'jpg' | 'webp'>;
	/** Default compression: 60 */
	compression?: number;
} & AtLeastOne<{
	width: number;
	height: number;
}>;

export type BuiltCollection = Omit<Collection<string>, 'icon' | 'versions' | 'upload' | 'auth'> & {
	slug: CollectionSlug;
	type: 'collection';
	/** Make fields mandatory */
	fields: FieldBuilder<Field>[];
	/** The kebab-case version of the slug for urls */
	kebab: string;
	label: CollectionLabel;
	asTitle: string;
	asThumbnail: string | null;
	auth?: CollectionAuthConfig;
	versions?: Required<VersionsConfig>;
	upload?: UploadConfig;
	icon: Component<IconProps>;
	access: WithRequired<Access, 'create' | 'read' | 'update' | 'delete'>;
	_generateTypes?: false;
	_generateSchema?: false;
	_generateRoutes?: false;
};

export type BuiltAreaClient = Omit<BuiltArea, '$url' | '$hooks'>;

export type BuiltArea = Omit<Area<string>, 'versions'> & {
	slug: AreaSlug;
	type: 'area';
	/** Make fields mandatory */
	fields: FieldBuilder<Field>[];
	/** The kebab-case version of the slug for urls */
	kebab: string;
	label: string;
	asTitle: string;
	versions?: Required<VersionsConfig>;
	icon: Component<IconProps>;
	access: WithRequired<Access, 'create' | 'read' | 'update' | 'delete'>;
	_generateTypes?: false;
	_generateSchema?: false;
	_generateRoutes?: false;
};
export type BuiltCollectionClient = Omit<BuiltCollection, '$url' | '$hooks'>;

// export type Config = Omit<Config, 'collections' | 'areas'> & {
// 	collections?: BuiltCollection[];
// 	areas?: BuiltArea[];
// };

export type BuiltConfig = {
	/** Database location relative to the root project ex: ./db/my-app.sqlite */
	$database: string;
	/** The database location */
	siteUrl?: string;
	/** list of collections */
	collections: BuiltCollection[];
	/** list of areas */
	areas: BuiltArea[];
	/** Define wich language the cms support */
	localization?: LocalizationConfig;
	icons: Record<string, any>;
	$trustedOrigins: string[];
	$routes?: Record<string, RouteConfig>;
	$plugins?: Plugin[];
	plugins?: PluginClient[];
	panel: {
		routes: Record<string, CustomPanelRoute>;
		navigation: NavigationConfig;
		$access: (user?: User) => boolean;
		components: {
			header: Component[];
			collectionHeader?: Component[];
			dashboard?: Component<{ entries: DashboardEntry[]; user?: User }>;
		};
		css?: string;
		/**
		 * Define the panel language
		 *
		 * If none defined it will try to use the current locale if the translation is available
		 */
		language: 'fr' | 'en';
	};
	$custom?: Record<string, any>;
	custom?: Record<string, any>;
};

export type ServerConfigProps =
	| '$adapter'
	| '$database'
	| '$trustedOrigins'
	| '$routes'
	| '$smtp'
	| '$custom'
	| '$plugins'
	| '$auth';

export type SanitizedConfigClient = Omit<Config, ServerConfigProps | 'collections' | 'areas'> & {
	collections?: BuiltCollectionClient[];
	areas?: BuiltAreaClient[];
};
export type BuiltConfigClient = Omit<
	BuiltConfig,
	ServerConfigProps | 'panel' | 'collections' | 'areas'
> & {
	collections: BuiltCollectionClient[];
	areas: BuiltAreaClient[];
	icons: Dic<Component<IconProps>>;
	panel: {
		routes: Record<string, CustomPanelRoute>;
		language: 'fr' | 'en';
		navigation: NavigationConfig;
		components: {
			header: Component[];
			collectionHeader?: Component[];
			dashboard?: Component<{ entries: DashboardEntry[]; user?: User }>;
		};
	};
};

// Hook collections
export type CollectionHooks<S extends DocType> = {
	beforeOperation?: HookBeforeOperation<S>[];
	beforeCreate?: (Hook<S, 'create', 'before'> | Hook<S, 'update' | 'create', 'before'>)[];
	beforeRead?: Hook<S, 'read', 'before'>[];
	beforeUpdate?: (Hook<S, 'update', 'before'> | Hook<S, 'update' | 'create', 'before'>)[];
	beforeDelete?: Hook<S, 'delete', 'before'>[];
	afterCreate?: (Hook<S, 'create', 'after'> | Hook<S, 'update' | 'create', 'after'>)[];
	afterUpdate?: (Hook<S, 'update', 'after'> | Hook<S, 'update' | 'create', 'after'>)[];
	afterDelete?: Hook<S, 'delete', 'after'>[];
};

export type AreaHooks<S extends DocType> = {
	beforeOperation?: HookBeforeOperation<S>[];
	beforeRead?: Hook<S, 'read', 'before'>[];
	beforeUpdate?: (Hook<S, 'update', 'before'> | Hook<S, 'update' | 'create', 'before'>)[];
	afterUpdate?: Hook<S, 'update', 'after'>[];
};
