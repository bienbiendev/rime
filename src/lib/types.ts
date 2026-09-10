// Auth types
export type { User } from '$lib/core/auth/types.js';

// Config types
export type {
  Area,
  AreaHooks,
  BuiltArea,
  BuiltAreaClient,
  BuiltCollection,
  BuiltCollectionClient,
  BuiltConfig,
  BuiltConfigClient,
  Collection,
  CollectionHooks,
  Config,
  RouteConfig,
  SanitizedConfigClient
} from './core/config/types.js';
export type { AdditionalStaffConfig } from './core/auth/types.js';
export type { CustomPanelRoute } from './core/panel/types.js';
export type { ImageSizesConfig } from './core/prototype/collection/upload/types.js';
export type { LocaleConfig, LocalizationConfig } from './core/locale/types.js';

// Doc types
export type {
  AreaSlug,
  BaseDoc,
  CollectionSlug,
  GenericBlock,
  GenericDoc,
  Prototype,
  PrototypeSlug
} from './core/prototype/types.js';

// Fields types
export type * from '$lib/fields/types.js';

// Panel types
export type {
  CollectionProps,
  FieldPanelTableConfig,
  FormErrors,
  Navigation,
  Route
} from './panel/types.js';

export type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';

// Upload types
export type { JsonFile, UploadDoc } from '$lib/core/prototype/collection/upload/types.js';
export type { Link } from './fields/link/types.js';

// Util
export type { WithRelationPopulated } from '$lib/core/fields/types.js';

export type { RouteHandlers } from './core/handlers/routes.server.js';
export type { Plugin } from './core/plugins/index.js';
export type { Rime, RimeContext } from './core/rime.server.js';
export type { BlocksFieldBlockRenderTitle } from './fields/blocks/index.js';
export type {
  RichTextFeature,
  RichTextFeatureMark,
  RichTextFeatureNode
} from './fields/rich-text/core/types.js';

/** What a plugin declares when it needs a table of its own — see `BuiltConfig.$tables`. */
export type { TableDeclaration, ColumnDeclaration, ColumnType } from './core/adapter.js';
