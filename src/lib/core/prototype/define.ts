import type { Adapter } from '$lib/core/adapter/types.js';
import type { BuiltArea, BuiltCollection, RouteConfig } from '$lib/core/config/types.js';
import { applyAugments } from '$lib/core/features/apply.js';
import type { AnyHook, FeatureDefinition, HookTiming } from '$lib/core/features/define.js';
import type { Dic } from '$lib/util/types.js';
import { FileText } from '@lucide/svelte';
import type { RequestEvent } from '@sveltejs/kit';
import { prototypeKebab } from './naming.js';
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
   * The kind's name, and the `type` every config it builds carries.
   *
   * Declared rather than taken from the registry key, because `create` is composed here and a
   * config's `type` is what pairs it back to its definition. Both registries still key on it, and
   * both keep that set closed against `PrototypeName`, so the export name and this stay the same
   * word — and `RegisteredPrototype` is no longer a definition plus a name.
   */
  name: string;

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
   * The prototype's **own** augments, in the order they run — before every feature's.
   *
   * The other half of what used to be a hand-written config factory per prototype per side. A
   * prototype's own defaulting is an augment like any other (a collection normalises its `label`
   * and seeds its panel defaults; an area falls back to a capitalised slug), so it is declared
   * here and `create` below runs it, rather than each factory spelling the chain out again.
   *
   * `any` for the reason `FeatureDefinition.augment` is `any`: each augment names the shape it
   * needs, and a list holding several cannot promise any of them that shape.
   */
  augments?: readonly ((config: any) => any)[];

  /**
   * The config member this prototype's instances are authored under — `collections`, `areas`.
   *
   * Declared here so that nothing else has to know the two by name: `prototypeConfigs()` folds the
   * registry with it, which is how core and the adapter iterate every prototype config in a build
   * without naming a kind.
   */
  configKey: string;

  /**
   * What a document of this kind is called when no field is marked as the title.
   *
   * The prototype's statement about the base thing, and the bottom of the precedence the `title`
   * feature resolves: a field marked `.isTitle()` wins, then whatever a feature overrode this
   * with, then this. It is not part of the authoring surface — a config author marks a field
   * instead — so the config factories seed it internally, as `_titleFallback`.
   */
  titleFallback: string;

  /**
   * The prototype's *own* document hooks: the ones that are its, unconditionally.
   *
   * Short and free of conditionals — a hook that runs only when a config declares something
   * belongs to the feature that owns that something, behind its `enabled`. `buildPipeline` merges
   * this with what the listed features contribute, and `resolvePipeline` decides the order from
   * the marks each hook declares, so nothing here names a feature or says where its hooks go.
   */
  hooks?: Partial<Record<HookTiming, AnyHook[]>>;

  /**
   * What this prototype adds to the **whole** config, rather than to one config of its own kind.
   *
   * The mirror of `FeatureDefinition.configure`: some of what a kind is responsible for is a
   * statement about the config as a whole. For both prototypes here that is one line — its own
   * list exists, empty if the user named none — so that no step downstream has to guard it.
   *
   * What it does to the config's *type* is declared in register.ts, which is what makes the
   * defaulting worth doing: `config.areas` is not `possibly undefined` after it.
   */
  configure?: (config: any) => any;

  /**
   * The config factory: what turns what an author wrote into a built config of this kind.
   *
   * **Composed by `definePrototype`, never passed in.** It is `augments`, then `features`, then
   * the shaping every prototype does the same way — the slug's kebab form, the `type`, the
   * fallbacks for `fields`, `icon` and `live`, and the staff-only access defaults. There is one
   * of it rather than a client and a server copy: the two differed only in listing their members
   * by hand versus spreading them, and `BuiltCollectionClient = BuiltCollection` already said the
   * two shapes are the same.
   *
   * Typed loosely here, and narrowed where it is re-exported: a prototype's authoring type is
   * generic in the slug (`Collection<S>` types `$hooks` and `$url` from it) and no type parameter
   * can carry a generic type. So `collection/definition.ts` re-exports a one-line `create` that
   * states its own signature, which is also the file a config author's `Collection.create` comes
   * from.
   */
  create: (slug: string, config: Dic) => C;

  /**
   * Run once per process, per config of this kind. The prototype's own boot hook: what a kind
   * needs doing before any request can be served.
   */
  boot?: (args: PrototypeBootArgs<C>) => Promise<void>;

  /**
   * The local API this prototype provides — what `rime.<name>(slug)` hands back.
   *
   * Returns a plain object of operations. `buildPrototypeApi` adds `blank` and `system` around it,
   * since every prototype has them and none needs its own version.
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
   * `core/dev/codegen/routes/` reads this to write the `+server.ts` files and
   * `handlers/routes.server.ts` dispatches through it, so an endpoint appears by being declared
   * here and nowhere else.
   */
  rest?: Record<string, RouteConfig>;

  /**
   * Type-only. The accessor this definition contributes to `event.locals.rime`, carrying the
   * slug literals and document types that a mapped type cannot recover from a runtime registry.
   *
   * Never assigned — the same `$Infer…` device `BuildConfig` uses for plugins and auth plugins.
   * See prototype/accessors.server.ts for where the accessors are actually read from, and why.
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
 * A prototype definition as the registry hands it back.
 *
 * An alias now rather than an intersection: `name` moved onto the definition itself when `create`
 * did, since a built config's `type` is that name and `create` has to know it. The registry key is
 * still the same word — `protos` is held to `PrototypeName` on both sides — so nothing is
 * synthesised on the way out.
 */
export type RegisteredPrototype = PrototypeDefinition;

type PrototypeOptions<C extends BuiltPrototype> = Partial<
  Omit<PrototypeDefinition<C>, '$InferAccessor' | 'create'>
>;

/**
 * Staff-only, and what every prototype's access defaults to until the author says otherwise.
 *
 * Typed on the one member it reads rather than on `User`, which is the `auth` feature's — a
 * prototype does not know what a feature is, and a parameter is contravariant, so this still
 * satisfies an `Access` member.
 */
const isStaff = (user?: { isStaff?: boolean }) => !!user && !!user.isStaff;

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
   * One chain, stated once for every prototype.
   *
   * `_titleFallback` is seeded first because it is the bottom of the precedence the `title`
   * feature resolves, and it is internal rather than authoring surface. Then the prototype's own
   * augments, then the features' in the order the prototype listed them — which is the order
   * their fields land in, and therefore column order.
   *
   * No hooks step: a config's pipeline is resolved once the *whole* config exists (see
   * prototype/pipelines.server.ts), so a config a feature derived is resolved by the same line as
   * one an author wrote, and `$hooks` stays what the author wrote until then.
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
