import type { TableDeclaration, VersionsTable } from '#lib/core/adapter.js';
import type { LocalizationConfig } from '#lib/core/locale/types.js';
import type {
  PanelConfig,
  CollectionPanelConfig,
  CustomPanelRoute,
  NavigationConfig
} from '#lib/core/panel/types.js';
import type { CacheConfig } from '#lib/core/plugins/cache/types.js';
import type { CollectionAuthConfig, AdditionalStaffConfig } from '#lib/core/auth/types.js';
import type { CollectionLabel } from '#lib/core/prototype/collection/types.js';
import type { UploadConfig } from '#lib/core/prototype/collection/upload/types.js';
import type { VersionsConfig } from '#lib/core/prototype/shared/versions/types.js';
import type { Adapter } from '#lib/core/adapter.js';
import type { Hook, HookBeforeOperation } from '#lib/core/pipeline/types.js';
import type { Plugin } from '#lib/core/plugins/index.js';
import type { SMTPConfig } from '#lib/core/plugins/mailer/index.server.js';
import type { SSEConfig } from '#lib/core/plugins/sse/types.js';
import type { Field } from '#lib/fields/types.js';
import type { RegisterArea, RegisterCollection } from '#lib/index.js';
import type { DashboardEntry } from '#lib/panel/pages/dashboard/types.js';
import type { AreaSlug, CollectionSlug, User } from '#lib/types.js';
import type { Dic, WithRequired } from '#lib/util/types.js';
import type { IconProps } from '@lucide/svelte';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import type { Component } from 'svelte';
import type { FieldBuilder } from '../fields/builders/index.js';
import type { DocType, GenericDoc } from '../prototype/types.js';

/**
 * What an author writes.
 */
export interface Config {
  /** The collections an author writes. Optional here, defaulted to `[]` by the config chain. */
  collections?: BuiltCollection[];
  /** The areas an author writes. Optional here, defaulted to `[]` by the config chain. */
  areas?: BuiltArea[];
  /** If config.siteUrl is defined, a preview button is added
	on the panel dahsboard, pointing to this url  */
  siteUrl?: string;
  /** The name at the top of the panel's sidebar. Without it, the host of `siteUrl`, then "rime". */
  siteName?: string;
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
  };
  /** List of locales for document i18n
   * @example
   * ```typescript
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
  /**
   * Origins, besides the site's own, allowed to call the API from a browser.
   *
   * @example
   * ```typescript
   * $trustedOrigins: ['https://app.example.com']
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
  /**
   * The event stream at `/api/sse`: which keys a caller may listen to.
   *
   * @example
   * ```typescript
   * $sse: { access: (key, user) => key.startsWith('public:') || (key === `user:${user?.id}`) }
   * ```
   */
  $sse?: SSEConfig;
  /** Custom API routes
   * @example
   * $routes: {
   * 	'/hello' : {
   * 		GET: (event) => json({ message: 'hello' }),
   * 		POST: (event) => sayHello(event).then(() => json({ message: 'Successfully said hello' })),
   * 	}
   * }
   */
  $routes?: Record<string, RouteConfig>;
  /** List of plugins — safety for anything server-only inside one comes from the
   * $rime/.../module convention, not from a $-prefix on this key */
  plugins?: Plugin[];
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

export type RouteConfig = {
  POST?: RequestHandler;
  GET?: RequestHandler;
  PATCH?: RequestHandler;
  DELETE?: RequestHandler;
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
  /** If the document can be edited live. Needs `$url` set too. */
  live?: boolean;
};

/**
 * What `$url` is given to format a document's url.
 *
 * ```ts
 * $url: ({ path, locale, doc }) => `/${locale}/${path.join('/')}`
 * // path ['services', 'web'], slug 'web', locale 'en' -> '/en/services/web'
 * ```
 *
 * A pure, synchronous function of these: the url is stored when a page is saved or moved, and
 * found by, so it has to come from nothing else. A relative url is made absolute against
 * `SITE_URL`.
 */
type UrlArgs<Doc> = {
  /** The slugs from the top page down to this one; empty for an area. */
  path: string[];
  /** This page's own slug; empty for an area. */
  slug: string;
  /** The locale the url is for; empty when the config has no localization. */
  locale: string;
  doc: Doc;
};

export type Collection<S> = {
  slug: S;
  /** The collection label */
  label?: string | CollectionLabel;
  /** Auth type and availables roles */
  auth?: boolean | CollectionAuthConfig;
  /** Operation hooks */
  $hooks?: CollectionHooks<S extends keyof RegisterCollection ? S : any>;
  /**
   * Formats a document's url from its address. With it, each page gets a built-in slug, an address
   * per locale, and `url`, `_urlPath`, `_slug` on its documents. See `UrlArgs`.
   */
  $url?: (
    args: UrlArgs<S extends keyof RegisterCollection ? RegisterCollection[S] : any>
  ) => string;
  /** Whether a document can have children/parent */
  nested?: boolean;
  /** Whether the collection support file upload */
  upload?: boolean | UploadConfig;
  /** Panel configuration, set false to hide the collection from the panel */
  panel?: CollectionPanelConfig;
} & PrototypeConfig;

export type Area<S> = PrototypeConfig & {
  slug: S;
  /**
   * Formats the area's url when it is saved, from its published document: `path` and `slug` are
   * empty. See `UrlArgs`.
   */
  $url?: (args: UrlArgs<S extends keyof RegisterArea ? RegisterArea[S] : any>) => string;
  $hooks?: AreaHooks<S extends keyof RegisterArea ? S : any>;
  /** The area label */
  label?: string;
  /** Panel configuration, set false to hide the area from the panel */
  panel?:
    | false
    | {
        /** Description for the collection/area, basically displayed on the dashboard */
        description?: string;
        /** Sidebar navigation group */
        group?: string;
      };
};

export type BuiltCollection = Omit<Collection<string>, 'icon' | 'versions' | 'upload' | 'auth'> & {
  slug: CollectionSlug;
  type: 'collection';
  /**
   * What a new document starts with: every default applied, and no id — see
   * `prototype/initial.ts`, which every config carries as this method.
   */
  initial(event?: RequestEvent): GenericDoc;
  /** Make fields mandatory */
  fields: FieldBuilder<Field>[];
  /** The kebab-case version of the slug for urls */
  kebab: string;
  label: CollectionLabel;
  asTitle: string;
  asThumbnail: string | null;
  auth?: CollectionAuthConfig;
  versions?: Required<VersionsConfig>;
  /**
   * Where this config's content lives, when it is not its own row.
   *
   * Stamped by `augmentVersions` on a versioned config; `undefined` otherwise, which reads as
   * "the document's own row". Declared here beside `versions` because it is the same statement.
   * The adapter reads it, so it reads data rather than calling a feature.
   */
  _versions?: VersionsTable;
  upload?: UploadConfig;
  icon: Component<IconProps>;
  access: WithRequired<Access, 'create' | 'read' | 'update' | 'delete'>;
  /**
   * How the panel's dashboard should list this collection, when a feature has an opinion.
   *
   * Off the authoring surface — a config author writes `panel.dashboard.layout` — and the same
   * device as `_titleFallback` (core/prototype/shared/title/augment.ts): the feature that knows
   * states its preference, and whoever renders reads it. `upload` sets `'grid'`, because a
   * collection of files reads better as thumbnails. The dashboard's own default is `'rows'`, and
   * what an author wrote beats both.
   */
  _dashboardLayout?: 'rows' | 'grid';
  _generateTypes?: false;
  _generateSchema?: false;
  /**
   * Whose content this config holds, in slug space — the inverse of `_versions`.
   *
   * ```
   * pages              _shadowOf: undefined
   * $pages__versions   _shadowOf: 'pages'
   * ```
   *
   * Set by whichever feature derived the second table, so nothing has to read it off how the slug
   * is spelled. `undefined` on every config an author wrote, which makes
   * `config._shadowOf ?? config.slug` read as "the document this row belongs to".
   */
  _shadowOf?: string;
};

// The client build's area config: the same shape as `BuiltArea`. `$url` and `$hooks` are absent
// there at runtime.
export type BuiltAreaClient = BuiltArea;

export type BuiltArea = Omit<Area<string>, 'versions'> & {
  slug: AreaSlug;
  type: 'area';
  /**
   * What a new document starts with: every default applied, and no id — see
   * `prototype/initial.ts`, which every config carries as this method.
   */
  initial(event?: RequestEvent): GenericDoc;
  /** Make fields mandatory */
  fields: FieldBuilder<Field>[];
  /** The kebab-case version of the slug for urls */
  kebab: string;
  label: string;
  asTitle: string;
  versions?: Required<VersionsConfig>;
  /** See `BuiltCollection._versions`. */
  _versions?: VersionsTable;
  icon: Component<IconProps>;
  access: WithRequired<Access, 'create' | 'read' | 'update' | 'delete'>;
  _generateTypes?: false;
  _generateSchema?: false;
};
// The client build's collection config: the same shape as `BuiltCollection`.
export type BuiltCollectionClient = BuiltCollection;

/**
 * What the config chain produced.
 *
 * The two lists with the optionality gone — which is what the chain guarantees by defaulting each
 * to `[]`, so downstream reads `config.collections` without a guard.
 */
export type BuiltConfig = {
  collections: BuiltCollection[];
  areas: BuiltArea[];
  /** The site's URL. The panel dashboard shows a preview button pointing to it. */
  siteUrl?: string;
  /** The name at the top of the panel's sidebar. */
  siteName?: string;
  /** Define wich language the cms support */
  localization?: LocalizationConfig;
  icons: Record<string, any>;
  $trustedOrigins: string[];
  /**
   * Tables no prototype declares — better-auth's own, and whatever a plugin adds.
   *
   * Filled during the configure phase and appended to, so a consumer adding a better-auth plugin
   * can declare that plugin's storage. The schema generator emits exactly what is here.
   */
  $tables: TableDeclaration[];
  $routes?: Record<string, RouteConfig>;
  plugins?: Plugin[];
  panel: {
    routes: Record<string, CustomPanelRoute>;
    navigation: NavigationConfig;
    $access: (user?: User) => boolean;
    components: {
      header: Component[];
      collectionHeader?: Component<{ config: BuiltCollectionClient }>[];
      dashboard?: Component<{ entries: DashboardEntry[]; user?: User }>;
    };
    css?: string;
    /** The panel language. 'en' when none is set. */
    language: 'fr' | 'en';
  };
  $custom?: Record<string, any>;
  custom?: Record<string, any>;
};

/** The config members the sanitizer drops from the client build: every `$` key. */
type ServerConfigProps = Extract<keyof Config | keyof BuiltConfig, `$${string}`>;

// The prototype lists are not omitted and re-added: `BuiltCollectionClient` and `BuiltAreaClient`
// are aliases of the server types (see the note on `BuiltAreaClient`), so re-stating them named
// two kinds to say nothing. What the client build drops is the server-only config members.
export type SanitizedConfigClient = Omit<Config, ServerConfigProps>;

export type BuiltConfigClient = Omit<BuiltConfig, ServerConfigProps | 'panel'> & {
  icons: Dic<Component<IconProps>>;
  panel: {
    routes: Record<string, CustomPanelRoute>;
    language: 'fr' | 'en';
    navigation: NavigationConfig;
    components: {
      header: Component[];
      collectionHeader?: Component<{ config: BuiltCollectionClient }>[];
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
  afterUpdate?: (Hook<S, 'update', 'after'> | Hook<S, 'update' | 'create', 'after'>)[];
};
