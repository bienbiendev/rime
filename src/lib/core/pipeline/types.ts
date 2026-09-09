import type { HOOK_MARKS } from './marks.js';
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
 * Features and consumers extend it by merging into `FeatureHookMarks`, so this file names no
 * feature — **and that merge is a hole in the closed union**, because anything reaching it can put
 * any string in, including one core already uses. So every mark carries its owner
 * (`owner:name`, with `core` reserved) and the namespace is checked at boot. See `marks.ts`.
 */
export type HookMark = keyof FeatureHookMarks | CoreHookMark;

/**
 * Marks owned by core, **derived** from `HOOK_MARKS` rather than restated.
 *
 * It used to be a hand-written union beside a hand-written runtime list, with a spec whose only
 * job was to stop the two drifting. One source now: the object is the list, the union is read off
 * it, and adding a mark is adding a line to `marks.ts`.
 */
export type CoreHookMark = (typeof HOOK_MARKS)[keyof typeof HOOK_MARKS];

/**
 * Marks contributed by features, plugins and consumer configs, extended through declaration
 * merging so that neither this file nor any prototype names one:
 *
 * ```ts
 * declare module '$lib/core/pipeline/types.js' {
 *   interface FeatureHookMarks { 'upload:file-written': true }
 * }
 * ```
 *
 * **The key must be `owner:name`.** A bare word — `'session'`, `'ready'` — is refused at boot, and
 * the reason is that it reads like a name a second person would also reach for: two owners
 * merging the same bare key do not collide loudly, they silently join the same set and move
 * whatever waits on it. The `core` owner is reserved.
 *
 * Declare the value beside the interface, so nothing writes the string twice:
 *
 * ```ts
 * export const VERSIONS_MARKS = { OPERATION: 'versions:operation' } as const;
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
