import type { VersionsTable } from '$lib/core/adapter.js';
import type { LocalizationConfig } from '$lib/core/locale/types.js';
import type {
  PanelConfig,
  CollectionPanelConfig,
  CustomPanelRoute,
  NavigationConfig
} from '$lib/core/panel/types.js';
import type { CacheConfig } from '$lib/core/plugins/cache/types.js';
import type { CollectionAuthConfig, AdditionalStaffConfig } from '$lib/core/auth/types.js';
import type { CollectionLabel } from '$lib/core/prototype/collection/types.js';
import type { UploadConfig } from '$lib/core/prototype/collection/upload/types.js';
import type { VersionsConfig } from '$lib/core/prototype/shared/versions/types.js';
import type { Adapter } from '$lib/core/adapter.js';
import type { Hook, HookBeforeOperation } from '$lib/core/pipeline/types.js';
import type { Plugin } from '$lib/core/plugins/index.js';
import type { SMTPConfig } from '$lib/core/plugins/mailer/module.server.js';
import type { Field } from '$lib/fields/types.js';
import type { RegisterArea, RegisterCollection } from '$lib/index.js';
import type { DashboardEntry } from '$lib/panel/pages/dashboard/types.js';
import type { AreaSlug, CollectionSlug, User } from '$lib/types.js';
import type { Dic, WithRequired } from '$lib/util/types.js';
import type { IconProps } from '@lucide/svelte';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import type { Component } from 'svelte';
import type { FieldBuilder } from '../fields/builders/index.js';
import type { DocType } from '../prototype/types.js';

/**
 * What an author writes.
 *
 * The two prototype lists were merged in from beside each definition, through a
 * `PrototypeMembers` interface this extended. That kept core from naming a kind and made the
 * authoring surface of every config in the repo depend on a declaration-merging target whose
 * failure mode is silence: an augmentation that stops being reachable leaves the interface empty
 * and `config.collections` starts reading `any`, far from the cause.
 */
export interface Config {
  /** The collections an author writes. Optional here, defaulted to `[]` by the config chain. */
  collections?: BuiltCollection[];
  /** The areas an author writes. Same. */
  areas?: BuiltArea[];
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
  /** If the document can be edited live, if enabled the url prop must be set also. */
  live?: boolean;
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
  /** Panel configuration, set false to hide the collection from the panel */
  panel?: CollectionPanelConfig;
} & PrototypeConfig;

export type Area<S> = PrototypeConfig & {
  slug: S;
  /** A function to generate the document URL */
  $url?: (doc: S extends keyof RegisterArea ? RegisterArea[S] : any) => string;
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
   * "the document's own row". Declared here beside `versions` because it is the same statement,
   * and because five callers read it — two of them in `adapter-sqlite/`, which is what keeps the
   * adapter reading data rather than calling a feature.
   */
  _versions?: VersionsTable;
  upload?: UploadConfig;
  icon: Component<IconProps>;
  access: WithRequired<Access, 'create' | 'read' | 'update' | 'delete'>;
  /**
   * How the panel's dashboard should list this collection, when a feature has an opinion.
   *
   * Off the authoring surface — a config author writes `panel.dashboard.layout` — and the same
   * device as `_titleFallback`: the feature that knows states its preference, and whoever renders
   * reads it. `upload` sets `'grid'`, because a collection of files reads better as thumbnails.
   * The dashboard's own default is `'rows'`, and what an author wrote beats both.
   *
   * It replaced `augment-panel.ts`, where the collection prototype tested `config.upload` to pick
   * this — a prototype knowing what a feature is, and the whole reason this member exists.
   */
  _dashboardLayout?: 'rows' | 'grid';
  _generateTypes?: false;
  _generateSchema?: false;
  _generateRoutes?: false;
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

// Same shape as BuiltArea, not a narrower Omit — $url/$hooks are already optional on Area<S>,
// and nothing client-side ever reads them (they're genuinely absent at runtime there, since
// Area.create's client build never receives them — see core/areas/config/builder.ts). Kept
// as a distinct alias, not merged away entirely, purely so Plugin['configure'] has one
// uniform collections/areas shape to write against regardless of which build called it —
// narrowing collections/areas separately from the config-level secrets (see
// SanitizedConfigClient) bought type-safety nothing since no code ever depended on it.
export type BuiltAreaClient = BuiltArea;

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
  /**
   * Where this config's content lives, when it is not its own row.
   *
   * Stamped by `augmentVersions` on a versioned config; `undefined` otherwise, which reads as
   * "the document's own row". Declared here beside `versions` because it is the same statement,
   * and because five callers read it — two of them in `adapter-sqlite/`, which is what keeps the
   * adapter reading data rather than calling a feature.
   */
  _versions?: VersionsTable;
  icon: Component<IconProps>;
  access: WithRequired<Access, 'create' | 'read' | 'update' | 'delete'>;
  _generateTypes?: false;
  _generateSchema?: false;
  _generateRoutes?: false;
};
// See BuiltAreaClient just above for why this isn't a narrowing Omit.
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
  /** Database location relative to the root project ex: ./db/my-app.sqlite */
  $database: string;
  /** The database location */
  siteUrl?: string;
  /** Define wich language the cms support */
  localization?: LocalizationConfig;
  icons: Record<string, any>;
  $trustedOrigins: string[];
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
  '$adapter' | '$database' | '$trustedOrigins' | '$routes' | '$smtp' | '$custom' | '$auth';

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
  afterUpdate?: Hook<S, 'update', 'after'>[];
};
