import type { Adapter } from '$lib/core/adapter/types.js';
import type { BuiltArea, BuiltCollection, RouteConfig } from '$lib/core/factory/config/types.js';
import type { AnyHook, FeatureDefinition, HookTiming } from '$lib/core/features/define.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { GenericDoc } from './types.js';

/**
 * A prototype **defines** a kind of thing rime stores, and brings its own surface with it.
 *
 * That last part is the whole point, and it is what separates a prototype from the two other
 * layers around it:
 *
 * | layer | verb | scale |
 * | --- | --- | --- |
 * | **prototype** | *defines* | the base thing itself |
 * | **feature** | *augments and extends* | large — across prototypes, adds shadows and children |
 * | **plugin** | *augments* | small |
 *
 * So `collection` and `area` are not one implementation with a discriminator. They are two
 * definitions built to the same pattern, each stating what it is (`singleton`), what it needs
 * doing before requests arrive (`boot`), and what it lets a caller do (`api`). Nothing here
 * knows there are exactly two of them, which is what makes a third cost only its own folder.
 *
 * A definition carries no config: it is the *kind*, not an instance of it. The configs come from
 * the user, and `config.type` — the name the definition is exported under in registry.server.ts —
 * is what pairs them up.
 */
export type BuiltPrototype = BuiltArea | BuiltCollection;

export type PrototypeDefinition<C extends BuiltPrototype = BuiltPrototype, Accessor = unknown> = {
  /**
   * Whether exactly one document exists.
   *
   * On: create and delete are not operations (a second row is not a thing, and removing the only
   * one leaves nothing to read), reads and updates take no id, and the row has to exist before
   * runtime — hence `boot`. It is a fact about the data, not a kind, which is why it is the one
   * shape fact the adapter is told.
   */
  singleton: boolean;

  /**
   * The features that extend this prototype, **in the order their augments run** — which is the
   * order their fields land in, and therefore the order of the columns.
   *
   * By value, not by name, and declared here rather than each feature declaring `extends`. The
   * prototype owns its table, so the prototype says what may add to it and where. That also makes
   * this list the single source for the type fold: read `as const`, it is the same order at
   * compile time as at runtime, with no second tuple to keep in step.
   */
  features: FeatureDefinition[];

  /**
   * The prototype's *own* document hooks — the ones that are its, unconditionally.
   *
   * There is no `pipeline.server.ts` any more, and its absence is the point. That file listed
   * every hook by hand, including `...featureHooks(upload, collection, 'beforeRead')` and a
   * ternary per conditional — a prototype knowing the features that extend it, which is the
   * inversion this whole design removes. Every one of those conditionals turned out to be a
   * feature gate: `collection.auth ? [...] : []` is the auth feature's `enabled`.
   *
   * So what is left here is unconditional, and short. `buildPipeline` merges it with whatever the
   * listed features contribute and `resolvePipeline` decides the order from the marks each hook
   * declares. Nothing here names a feature; nothing here says where a feature's hook goes.
   */
  hooks?: Partial<Record<HookTiming, AnyHook[]>>;

  /**
   * What this prototype adds to the **whole** config, rather than to one config of its own kind.
   *
   * The mirror of `FeatureDefinition.configure`, and it exists for the same reason a feature has
   * one: some of what a kind is responsible for is a statement about the config as a whole. For
   * both prototypes here that is one line — its own list exists, empty if the user named none —
   * which the config factory used to do on their behalf in `augmentPrototypes`, naming
   * `collections` and `areas` itself.
   *
   * What it does to the config's *type* is declared in register.ts, beside the definition, since
   * the defaulting is only worth doing if `config.areas` stops being `possibly undefined`
   * downstream.
   */
  configure?: (config: any) => any;

  /**
   * Run once per process, per config of this kind. The prototype's own boot hook: what a kind
   * needs doing before any request can be served.
   */
  boot?: (args: PrototypeBootArgs<C>) => Promise<void>;

  /**
   * The local API this prototype provides — what `rime.<name>(slug)` hands back.
   *
   * Returns a plain object of operations. `blank` and `system` are added around it by
   * `buildPrototypeApi`, since every prototype has them and none of them has its own version.
   */
  api?: (ctx: PrototypeApiContext<C>) => Dic;

  /**
   * The REST surface this prototype provides, in the shape routes are already declared in:
   * `RouteConfig` per path, the same type `config.$routes` and `plugin.routes` use.
   *
   * The key is the sub-path **under `/api/[slug=<name>]`** — `''` for the list tier (a
   * singleton's only tier), `'[id]'`, `'[id]/duplicate'`. It differs from a plugin's key, which
   * is an absolute pathname, for the reason a prototype has no URL of its own to name: its
   * slugs come from the user's config, and the param matcher is what turns one into a route.
   *
   * `core/dev/codegen/routes/` reads this to write the `+server.ts` files, and
   * `handlers/routes.server.ts` dispatches through it — so an endpoint appears by being
   * declared here, not by also editing codegen.
   */
  rest?: Record<string, RouteConfig>;

  /**
   * Type-only. The accessor this definition contributes to `event.locals.rime`, carrying the
   * slug literals and document types that a mapped type cannot recover from a runtime registry.
   *
   * Never assigned — the same `$Infer…` device `BuildConfig` uses for plugins and auth plugins.
   * `PrototypeAccessors` (prototype/accessors.server.ts) no longer reads it — see the note there.
   */
  readonly $InferAccessor: Accessor;
};

export type PrototypeBootArgs<C extends BuiltPrototype = BuiltPrototype> = {
  /** A config of this definition's own kind — boot.server.ts pairs them by name. */
  config: C;
  adapter: Adapter;
  defaultLocale?: string;
};

/**
 * What a definition's operations are handed: the request, the config they run against, and the
 * plumbing that would otherwise be written out once per prototype.
 *
 * It is a per-call value, not a per-process one — `isSystemOperation` is part of it, so
 * `.system()` is a second context rather than a flag anybody has to remember to forward.
 */
export type PrototypeApiContext<C extends BuiltPrototype = BuiltPrototype> = {
  config: C;
  event: RequestEvent;
  defaultLocale: string | undefined;

  /** True when rime itself is the caller: access checks and some hooks stand down. */
  isSystemOperation: boolean;

  /** The locale to act in: the one asked for, else the request's, else the config's default. */
  fallbackLocale(locale?: string): string | undefined;

  /** A document of this config's shape with every default applied, and no id. */
  blank(): GenericDoc;

  /**
   * Read through the API cache when it is on and this is not a system call.
   *
   * `key` is merged into the cache key on top of the parts every read shares — the slug and who
   * is asking — so an operation only names what is particular to it.
   */
  cached<T>(operation: string, key: Dic, read: () => Promise<T>): Promise<T>;
};

/**
 * A built local API: whatever the definition's `api` returned, plus the two members every
 * prototype has.
 */
export type PrototypeApi<A, Doc = GenericDoc> = A & {
  blank(): Doc;
  /**
   * The same API, telling the pipeline that rime is the caller rather than a user.
   *
   * `system(false)` hands back this API unchanged — it does not turn a system API back into a
   * user one, which is what lets `system(someBoolean)` read as "escalate if needed".
   */
  system(isSystem?: boolean): PrototypeApi<A, Doc>;
};

/**
 * A prototype definition as the registry hands it back: the definition plus the name it is
 * exported under. See registry.server.ts — the name is the barrel key, not a field somebody has
 * to keep in sync with it.
 */
export type RegisteredPrototype = PrototypeDefinition & { name: string };

type PrototypeOptions<C extends BuiltPrototype> = Partial<
  Omit<PrototypeDefinition<C>, '$InferAccessor'>
>;

export const definePrototype = <C extends BuiltPrototype = BuiltPrototype, Accessor = unknown>(
  options: PrototypeOptions<C> = {}
): PrototypeDefinition<C, Accessor> =>
  ({
    singleton: options.singleton ?? false,
    // Defaulted rather than optional: `buildPipeline` filters this on every config, and a
    // prototype with no features is a real case (a third kind would start there). `hooks` stays
    // undefined-able because the pipeline already treats a missing timing as none.
    features: options.features ?? [],
    hooks: options.hooks,
    configure: options.configure,
    boot: options.boot,
    api: options.api,
    rest: options.rest
  }) as PrototypeDefinition<C, Accessor>;
