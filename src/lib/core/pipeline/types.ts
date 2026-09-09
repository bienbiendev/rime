import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { Docs, DocType, RawDoc } from '$lib/core/prototype/types.js';
import type { RegisterArea, RegisterCollection } from '$lib/index.js';
import type { PrototypeSlug } from '$lib/types.js';
import type { DeepPartial, Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { ConfigMap } from './config-map/types.js';

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
  /**
   * The row this document's content lives on, which is what its blocks, tree nodes and relations
   * hang off.
   *
   * The base row for a plain document, and the shadow row for one that has a shadow — `versions`
   * is the feature that makes those differ, and it is what sets this (see
   * features/versions/hooks/handle-new-version.server.ts). `params.versionId` above stays what the
   * caller asked for; this is where the answer goes.
   */
  contentOwnerId?: string;
  /** Parameter passed to an update operation when creating locale document fallback */
  isFallbackLocale?: string | undefined;
  /** The original document if on an update operation */
  originalDoc?: DocTypeForSlugs<S>;
  /** An map to get a field config by path on the original doc */
  originalConfigMap?: ConfigMap;
  /** An map to get a field config by path on incoming data */
  configMap?: ConfigMap;
  /** @TODO explain what it does */
  isSystemOperation?: boolean;
};

/**
 * Why a read is happening, which can change which row it means.
 *
 * - `'read'` — return this document. What every API read is.
 * - `'original'` — load what an update is about to change, so it can be diffed against and fallen
 *   back to.
 *
 * They are not the same question, and `versions` is where they diverge: on a read `?draft=true`
 * means "show me the newest revision", while on an update it means "branch a new draft **from the
 * published one**". That rule used to live in core, as
 * `VersionOperations.shouldRetrieveDraft(context.versionOperation)` inside `getOriginalDocument` —
 * a core step importing a feature's enum to decide a feature's policy. Core states that the two
 * intents exist, because both do for every prototype; `FeatureDefinition.readQuery` says what each
 * selects.
 */
export type ReadIntent = 'read' | 'original';

/** A REST-style query string, or its parsed form. Lives here because an operation's params
 *  carry it; the adapter consumes it from there. */
export type OperationQuery = string | ParsedOperationQuery;

export type ParsedOperationQuery = {
  where: Dic;
};

/**
 * What a hook declares about itself. Attached to the function, not wrapped around it, so every
 * call site keeps invoking it directly.
 *
 * Only a name, now. It used to carry `requires`/`provides` and a resolver computed the order from
 * them; the order is written down in each prototype's `hooks.server.ts` instead — see the note
 * there for why.
 */
export type HookMarks = {
  /**
   * Identifies the hook in the generated pipeline and the order fixture.
   *
   * Cannot be inferred: these hooks are written `export const x = Hooks.beforeRead(fn)`, where
   * the function is an *argument*, so JS never gives it a name and `fn.name` is `''`.
   */
  name: string;
};

/**
 * A hook's name lives on the function at runtime and deliberately **not** in its type.
 *
 * Putting it in the type (`Hook<S, …> & HookMarks`) breaks every consumer: intersecting a
 * function type with an object loses the assignability that lets a `Hook<'raw', 'read', 'before'>`
 * — what `Hooks.beforeRead(fn)` infers when the handler carries no explicit slug — land in a
 * `CollectionHooks<'pages'>`. Nothing needs it there: only the pipeline chart reads it, through
 * `hookName()`.
 */
