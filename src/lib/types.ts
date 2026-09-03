// Auth types
export type { User } from './core/features/auth/types.js';

// Config types
export type {
  AdditionalStaffConfig,
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
  CustomPanelRoute,
  ImageSizesConfig,
  LocaleConfig,
  LocalizationConfig,
  RouteConfig,
  SanitizedConfigClient
} from './core/factory/config/types.js';

// Doc types
export type {
  AreaSlug,
  BaseDoc,
  CollectionSlug,
  GenericBlock,
  GenericDoc,
  Prototype,
  PrototypeSlug,
  UploadDoc
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
export type { JsonFile } from './core/features/upload/types.js';
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
