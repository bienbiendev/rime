import type { Adapter } from '$lib/core/adapter.js';
import type { BuiltArea, BuiltCollection, RouteConfig } from '$lib/core/config/types.js';
import { applyAugments } from '$lib/core/features/apply.js';
import type { FeatureDefinition } from '$lib/core/features/define.js';
import { isStaff } from '$lib/core/features/auth/access.js';
import type { AnyHook, HookTiming, OperationQuery, ReadIntent } from '$lib/core/pipeline/types.js';
import type { Dic } from '$lib/util/types.js';
import { FileText } from '@lucide/svelte';
import type { RequestEvent } from '@sveltejs/kit';
import { prototypeKebab } from './naming.js';
import type { GenericDoc } from './types.js';

/**
 * A prototype **defines** a kind of thing rime stores, and brings its own surface with it.
 *
 * | layer         | verb                   | scale                        |
 * | ------------- | ---------------------- | ---------------------------- |
 * | **prototype** | *defines*              | the base thing itself        |
 * | **feature**   | *augments and extends* | large — across prototypes    |
 * | **plugin**    | *augments*             | small                        |
 *
 * So `collection` and `area` are two definitions built to the same pattern, not one
 * implementation with a discriminator. Nothing here knows there are two of them, which is what
 * makes a third cost only its own folder.
 *
 * A definition carries no config — it is the kind, not an instance. `config.type` is the name it
 * is registered under, and that is what pairs the two.
 */
export type BuiltPrototype = BuiltArea | BuiltCollection;

export type PrototypeDefinition<C extends BuiltPrototype = BuiltPrototype, Accessor = unknown> = {
  /** The kind's name, and the `type` every config it builds carries. */
  name: string;

  /**
   * Whether exactly one document exists.
   *
   * On: no create, no delete, reads and updates take no id, and the row must exist before runtime
   * — hence `boot`. A fact about the data rather than the kind, which is why it is the one shape
   * fact the adapter is told.
   */
  singleton: boolean;

  /**
   * The features that extend this prototype, **in the order their augments run** — which is the
   * order their fields land in, and therefore column order.
   *
   * By value, and declared here rather than each feature declaring `extends`: the prototype owns
   * its table, so it says what may add to it. Read `as const`, this is also the type fold's source,
   * so there is no second tuple to keep in step.
   */
  features: FeatureDefinition[];

  /**
   * The prototype's own augments, before every feature's.
   *
   * `any` for the reason `FeatureDefinition.augment` is: each augment names the shape it needs, and
   * a list holding several cannot promise any of them that shape.
   */
  augments?: readonly ((config: any) => any)[];

  /** The config member instances are authored under — `collections`, `areas`. */
  configKey: string;

  /**
   * What a document is called when no field is marked as the title.
   *
   * The bottom of the precedence `title` resolves: a `.isTitle()` field wins, then whatever a
   * feature overrode this with, then this. Seeded as `_titleFallback`, not authoring surface.
   */
  titleFallback: string;

  /**
   * Every hook this prototype can run, in the order it runs them — including its features'.
   *
   * The order is written down, not computed; see `collection/hooks.server.ts`. `buildPipeline`
   * decides only *which* of them a config runs, from the feature each hook names.
   */
  hooks?: Partial<Record<HookTiming, AnyHook[]>>;

  /**
   * What this prototype adds to the **whole** config rather than to one of its own kind.
   *
   * For both prototypes here that is one line — its own list exists, empty if the author named
   * none — so nothing downstream has to guard it. The type side is declared in register.ts.
   */
  configure?: (config: any) => any;

  /**
   * The config factory. **Composed by `definePrototype`, never passed in**: `augments`, then
   * `features`, then the shaping every prototype does the same way.
   *
   * Typed loosely here and narrowed where it is re-exported — a prototype's authoring type is
   * generic in the slug and no type parameter can carry a generic type, so
   * `collection/definition.ts` re-exports a one-line `create` stating its own signature.
   */
  create: (slug: string, config: Dic) => C;

  /** Run once per process, per config of this kind, before any request is served. */
  boot?: (args: PrototypeBootArgs<C>) => Promise<void>;

  /**
   * The local API — what `rime.<name>(slug)` hands back. `buildPrototypeApi` adds `blank` and
   * `system` around it, since every prototype has them.
   */
  api?: (ctx: PrototypeApiContext<C>) => Dic;

  /**
   * The REST surface, keyed by sub-path **under `/api/[slug=<name>]`** — `''`, `'[id]'`,
   * `'[id]/duplicate'`. Not an absolute pathname like a plugin's: a prototype has no URL of its
   * own, only slugs the author's config supplies.
   *
   * `dev/codegen/routes/` writes the `+server.ts` files from this and `handlers/routes.server.ts`
   * dispatches through it, so an endpoint exists by being declared here and nowhere else.
   */
  rest?: Record<string, RouteConfig>;

  /**
   * Type-only. The accessor this definition contributes to `event.locals.rime`, carrying the slug
   * literals a mapped type cannot recover from a runtime registry.
   *
   * Never assigned — the same `$Infer…` device `BuildConfig` uses. See accessors.server.ts.
   */
  readonly $InferAccessor: Accessor;
};

export type PrototypeBootArgs<C extends BuiltPrototype = BuiltPrototype> = {
  /** A config of this definition's own kind — boot.server.ts pairs them by name. */
  config: C;
  adapter: Adapter;
  defaultLocale?: string;
  /**
   * Handed down rather than read off the definition: `boot` is written inside the object literal
   * that defines it, so it cannot name itself.
   */
  features: FeatureDefinition[];
};

/**
 * What a definition's operations are handed: the request, the config, and the plumbing that would
 * otherwise be written out once per prototype.
 *
 * Per-call, not per-process — `isSystemOperation` is part of it, so `.system()` is a second
 * context rather than a flag anybody has to remember to forward.
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
   * Which content row a read means, as the feature owning the difference narrows it. `undefined`
   * for a prototype whose content is on its own row.
   *
   * Pass `intent: 'original'` when loading what an update is about to change — the same parameters
   * can select a different row. Defaults to `'read'`.
   */
  contentQuery(
    params: { draft?: boolean; versionId?: string },
    intent?: ReadIntent
  ): OperationQuery | undefined;

  /**
   * The features extending this prototype.
   *
   * Exposed rather than folded into a capability, unlike `blank()`, because its one consumer folds
   * it at a point only `runUpdate` can pick — after the data hooks, before the write.
   */
  readonly features: FeatureDefinition[];

  /**
   * Read through the API cache when it is on and this is not a system call. `key` is merged on top
   * of what every read shares — the slug and who is asking.
   */
  cached<T>(operation: string, key: Dic, read: () => Promise<T>): Promise<T>;
};

/** Whatever the definition's `api` returned, plus the two members every prototype has. */
export type PrototypeApi<A, Doc = GenericDoc> = A & {
  blank(): Doc;
  /**
   * The same API, telling the pipeline that rime is the caller. `system(false)` hands this one
   * back unchanged, which is what lets `system(someBoolean)` read as "escalate if needed".
   */
  system(isSystem?: boolean): PrototypeApi<A, Doc>;
};

type PrototypeOptions<C extends BuiltPrototype> = Partial<
  Omit<PrototypeDefinition<C>, '$InferAccessor' | 'create'>
>;

export const definePrototype = <C extends BuiltPrototype = BuiltPrototype, Accessor = unknown>(
  options: PrototypeOptions<C> = {}
): PrototypeDefinition<C, Accessor> => {
  const name = options.name ?? '';
  // Defaulted rather than optional: `buildPipeline` filters it on every config, and a prototype
  // with no features is a real case. `hooks` stays optional — a missing timing is already none.
  const features = options.features ?? [];
  const augments = options.augments ?? [];
  const titleFallback = options.titleFallback ?? 'id';

  /**
   * One chain, stated once for every prototype: `_titleFallback` first, then the prototype's own
   * augments, then the features' in the order it listed them — which is column order.
   *
   * No hooks step. A config's pipeline is resolved once the *whole* config exists (see
   * pipelines.server.ts), so a derived config resolves by the same line as an authored one.
   */
  const create = (slug: string, incomingConfig: Dic): C => {
    const initial: Dic = { ...incomingConfig, slug, _titleFallback: titleFallback };
    const withOwn = augments.reduce((current, augment) => augment(current), initial);
    const augmented = applyAugments(features, withOwn) as Dic;

    return {
      ...augmented,
      type: name,
      slug,
      kebab: prototypeKebab(slug),
      fields: augmented.fields || [],
      icon: augmented.icon || FileText,
      live: augmented.live || false,
      /**
       * Staff-only until the author says otherwise, and `isStaff` is **auth's**.
       *
       * There used to be a copy of it here, typed on the one member it reads, with a comment
       * saying a prototype does not know what a feature is. But defaulting to staff-only *is*
       * knowing — the copy duplicated the dependency rather than removing it. Removing it means
       * the default coming from whichever feature owns the policy, which is a real change.
       */
      access: {
        create: isStaff,
        read: isStaff,
        update: isStaff,
        delete: isStaff,
        ...augmented.access
      }
    } as C;
  };

  return {
    name,
    singleton: options.singleton ?? false,
    configKey: options.configKey ?? '',
    titleFallback,
    features,
    augments,
    create,
    hooks: options.hooks,
    configure: options.configure,
    boot: options.boot,
    api: options.api,
    rest: options.rest
  } as PrototypeDefinition<C, Accessor>;
};
