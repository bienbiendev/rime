import type { VersionOperation } from '$lib/core/features/versions/strategy.js';
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

/** A REST-style query string, or its parsed form. Lives here because an operation's params
 *  carry it; the adapter consumes it from there. */
export type OperationQuery = string | ParsedOperationQuery;

export type ParsedOperationQuery = {
  where: Dic;
};

/**
 * A named point in a pipeline's progress that a hook can wait on.
 *
 * The whole ordering mechanism. A hook declares what state it needs (`requires`) and what state
 * it leaves behind (`provides`), and the resolver computes the order — so no prototype has to
 * name a feature and no feature has to know where it sits.
 *
 * A closed union on purpose. `requires` is satisfied *vacuously* when nothing active provides
 * the mark (see resolve-pipeline.server.ts), which is what lets an unconditional hook depend on
 * a conditional one — `removePrivateFields` only exists when a collection has `auth`. That same
 * rule would silently reorder the pipeline on a typo, with no error anywhere, so the set of legal
 * marks has to be closed and a misspelling has to be a type error.
 *
 * Features extend it by merging into `FeatureHookMarks`, so a feature adds its own marks without
 * this file naming the feature.
 */
export type HookMark = keyof FeatureHookMarks | CoreHookMark;

/** Marks owned by core — the prototype's own hooks and the operation steps. */
export type CoreHookMark =
  /** Private fields are gone; anything deriving from the document may now read it. */
  | 'sanitized'
  /** Field values have been processed into their final document shape. */
  | 'shaped'
  /** The document's own title has been resolved. */
  | 'title'
  /** Anything that writes a document property declares this, so a hook that must run after every
   *  writer — `sortDocumentProps` — can wait on all of them without naming one. */
  | 'document'
  /**
   * Every hook that reads the caller's submission *as sent* has run, so hooks may now add to
   * `data`.
   *
   * The write-side twin of `sanitized`, and it exists because the auth guards are not merely
   * early by taste: `preventUserMutations` rejects on `'name' in args.data` and
   * `preventSuperAdminMutation` on `'isSuperAdmin' in args.data`, so a default filled in before
   * them turns an ordinary update into a 401. `forwardRolesToBetterAuth` reads `data.roles` the
   * same way. Nothing here names auth — a mark no active hook provides is satisfied, so on a
   * collection without it the shaping chain simply starts straight away.
   */
  | 'data-inspected'
  /** The blank document has been merged in, so `config.fields` is the final field list. */
  | 'blank-merged'
  /** `config.fields` is final and may be read to build a config map. */
  | 'config-fields'
  /** The config map for incoming data exists. */
  | 'config-map'
  /** The original document has been loaded. */
  | 'original-doc'
  /** The config map for the original document exists. */
  | 'original-config-map'
  /** The version operation for this request has been decided. */
  | 'version-operation'
  /** Incoming data has been validated. */
  | 'validated';

/**
 * Marks contributed by features, extended through declaration merging so that neither this file
 * nor any prototype names a feature:
 *
 * ```ts
 * declare module '$lib/core/pipeline/types.js' {
 *   interface FeatureHookMarks { 'upload:file-written': true }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FeatureHookMarks {}

/** How a hook declares itself to the resolver. Attached to the hook function, not wrapped
 *  around it, so every existing call site keeps invoking it directly. */
export type HookMarks = {
  /**
   * Identifies the hook in the generated pipeline and the order fixture.
   *
   * Cannot be inferred: these hooks are written `export const x = Hooks.beforeRead(fn)`, where
   * the function is an *argument*, so JS never gives it a name and `fn.name` is `''`.
   */
  name: string;
  /** Runs after **every** active hook that provides each of these. */
  requires: HookMark[];
  /** The marks this hook leaves behind. */
  provides: HookMark[];
};

/**
 * Marks live on the hook at runtime and deliberately **not** in its type.
 *
 * Putting them in the type (`Hook<S, …> & HookMarks`) breaks every consumer: intersecting a
 * function type with an object loses the assignability that lets a `Hook<'raw', 'read', 'before'>`
 * — what `Hooks.beforeRead(fn)` infers when the handler carries no explicit slug — land in a
 * `CollectionHooks<'pages'>`. Nothing needs them there: the resolver reads marks through
 * `marksOf()` (resolve-pipeline.server.ts), and a misspelling is still a compile error where it
 * matters, in the declaration object, because `HookMark` is closed.
 */
