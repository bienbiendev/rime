import type { VersionOperation } from '$lib/core/collections/versions/operations.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { Docs, DocType, RawDoc } from '$lib/core/types/doc.js';
import type { OperationQuery } from '$lib/core/types/index.js';
import type { RegisterArea, RegisterCollection } from '$lib/index.js';
import type { PrototypeSlug } from '$lib/types.js';
import type { DeepPartial, Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { ConfigMap } from '../configMap/types.js';

// Operation and timing types
export type Operation = 'read' | 'create' | 'update' | 'delete';
export type Timing = 'before' | 'after';

// Helper type for document types based on slugs
export type DocTypeForSlugs<S extends DocType = PrototypeSlug> = S extends PrototypeSlug
  ? S extends keyof RegisterCollection
    ? RegisterCollection[S]
    : S extends keyof RegisterArea
      ? RegisterArea[S]
      : RawDoc
  : S extends keyof Docs
    ? Docs[S]
    : RawDoc;

// Config type based on slug
export type ConfigForSlug<S extends DocType = PrototypeSlug> = S extends keyof RegisterCollection
  ? BuiltCollection & { slug: S }
  : S extends keyof RegisterArea
    ? BuiltArea & { slug: S }
    : S extends 'auth' | 'upload' | 'directory'
      ? BuiltCollection
      : BuiltArea | BuiltCollection;

// Universal hook context with all possible properties
export type HookContext<
  S extends DocType = PrototypeSlug,
  O extends Operation = Operation,
  T extends Timing = Timing
> = {
  event: RequestEvent;
  context: OperationContext<S>;
  config: ConfigForSlug<S>;
  operation: O;
} & (T extends 'before' // Before create: data is available, doc is never
  ? O extends 'create'
    ? {
        data: DeepPartial<DocTypeForSlugs<S>>;
        doc?: never;
      }
    : // Before read: doc is available, data is never
      O extends 'read'
      ? {
          doc: DocTypeForSlugs<S>;
          data?: never;
        }
      : // Before update: data is available, doc is never
        O extends 'update'
        ? {
            data: DeepPartial<DocTypeForSlugs<S>>;
            doc?: never;
          }
        : // Before delete: doc is available, data is never
          O extends 'delete'
          ? {
              doc: DocTypeForSlugs<S>;
              data?: never;
            }
          : object
  : // After create: both data and doc are available
    T extends 'after'
    ? O extends 'create'
      ? {
          data: DeepPartial<DocTypeForSlugs<S>>;
          doc: DocTypeForSlugs<S>;
        }
      : // After read: doc is available, data is never
        O extends 'read'
        ? {
            doc: DocTypeForSlugs<S>;
            data?: never;
          }
        : // After update: both data and doc are available
          O extends 'update'
          ? {
              data: DeepPartial<DocTypeForSlugs<S>>;
              doc: DocTypeForSlugs<S>;
            }
          : // After delete: doc is available, data is never
            O extends 'delete'
            ? {
                doc: DocTypeForSlugs<S>;
                data?: never;
              }
            : object
    : object);

// Hook function type
export type Hook<
  S extends DocType = PrototypeSlug,
  O extends Operation = Operation,
  T extends Timing = Timing
> = (context: HookContext<S, O, T>) => Promise<HookContext<S, O, T>>;

type HookBeforeOperationArgs<S extends DocType = PrototypeSlug, O extends Operation = Operation> = {
  event: RequestEvent;
  context: OperationContext<S>;
  config: S extends PrototypeSlug ? ConfigForSlug<S> : BuiltCollection | BuiltArea;
  operation: O;
};
export type HookBeforeOperation<
  S extends DocType = PrototypeSlug,
  O extends Operation = Operation
> = (args: HookBeforeOperationArgs<S, O>) => Promise<HookBeforeOperationArgs<S, O>>;

/**
 * Helper object for creating hooks with specific operation and timing
 */
export const Hooks = {
  /**
   * Creates a before read hook
   */
  beforeOperation: <S extends DocType = 'raw'>(
    handler: HookBeforeOperation<S, Operation>
  ): HookBeforeOperation<S, Operation> => handler,

  /**
   * Creates a before read hook
   */
  beforeRead: <S extends DocType = 'raw'>(
    handler: Hook<S, 'read', 'before'>
  ): Hook<S, 'read', 'before'> => handler,

  /**
   * Creates a before create hook
   */
  beforeCreate: <S extends DocType = 'raw'>(
    handler: Hook<S, 'create', 'before'>
  ): Hook<S, 'create', 'before'> => handler,

  /**
   * Creates a before upsert hook
   */
  beforeUpsert: <S extends DocType = 'raw'>(
    handler: Hook<S, 'create' | 'update', 'before'>
  ): Hook<S, 'create' | 'update', 'before'> => handler,

  /**
   * Creates a before update hook
   */
  beforeUpdate: <S extends DocType = 'raw'>(
    handler: Hook<S, 'update', 'before'>
  ): Hook<S, 'update', 'before'> => handler,

  /**
   * Creates a before delete hook
   */
  beforeDelete: <S extends DocType = 'raw'>(
    handler: Hook<S, 'delete', 'before'>
  ): Hook<S, 'delete', 'before'> => handler,

  /**
   * Creates an after read hook
   */
  afterRead: <S extends DocType = 'raw'>(
    handler: Hook<S, 'read', 'after'>
  ): Hook<S, 'read', 'after'> => handler,

  /**
   * Creates an after create hook
   */
  afterCreate: <S extends DocType = 'raw'>(
    handler: Hook<S, 'create', 'after'>
  ): Hook<S, 'create', 'after'> => handler,

  /**
   * Creates an after create hook
   */
  afterUpsert: <S extends DocType = 'raw'>(
    handler: Hook<S, 'create' | 'update', 'after'>
  ): Hook<S, 'create' | 'update', 'after'> => handler,

  /**
   * Creates an after update hook
   */
  afterUpdate: <S extends DocType = 'raw'>(
    handler: Hook<S, 'update', 'after'>
  ): Hook<S, 'update', 'after'> => handler,

  /**
   * Creates an after delete hook
   */
  afterDelete: <S extends DocType = 'raw'>(
    handler: Hook<S, 'delete', 'after'>
  ): Hook<S, 'delete', 'after'> => handler
};

export type OperationContext<S extends DocType = 'raw'> = Dic & {
  /** Parameters passed to the original operation method */
  params: {
    id?: string;
    versionId?: string;
    sort?: string;
    locale?: string;
    offset?: number;
    limit?: number;
    depth?: number;
    select?: string[];
    query?: OperationQuery;
    draft?: boolean;
  };
  /** Parameter passed to an update operation when creating locale document fallback */
  isFallbackLocale?: string | undefined;
  /** Type of version operation */
  versionOperation?: VersionOperation;
  /** The original document if on an update operation */
  originalDoc?: DocTypeForSlugs<S>;
  /** An map to get a field config by path on the original doc */
  originalConfigMap?: ConfigMap;
  /** An map to get a field config by path on incoming data */
  configMap?: ConfigMap;
  /** @TODO explain what it does */
  isSystemOperation?: boolean;
};
