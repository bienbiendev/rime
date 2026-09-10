import type { Adapter } from '$lib/core/adapter.js';
import type { BuiltArea, BuiltCollection, RouteConfig } from '$lib/core/config/types.js';
import { isStaff } from '$lib/core/auth/access.js';
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

export type PrototypeDefinition<C extends BuiltPrototype = BuiltPrototype> = {
  /** The kind's name, and the `type` every config it builds carries. */
  name: string;

  /**
   * **Every** augment this prototype runs, in order — its own and its features', one written list.
   *
   * A **function returning** the list, and that is rule 3 rather than style. Several of the steps
   * are imported from `$rime/modules`, and a feature reached through the barrel imports `create`
   * back out of this prototype's definition — `auth/staff/configure.ts` and
   * `versions/configure.server.ts` both do. Entered from the feature's side, an array literal here
   * would capture bindings the barrel had not initialised yet, and the config would build without
   * those fields: no error, no type change, just a document with no title. Building the list on
   * first `create` reads every binding after every module has finished.
   *
   * `any` for the reason each augment is typed loosely: each names the shape it needs, and a list
   * holding several cannot promise any of them that shape. A guarded entry is `when(pred, fn)`.
   */
  augments?: () => readonly ((config: any) => any)[];

  /**
   * Every hook this prototype can run, in the order it runs them — including its features'.
   *
   * The order is written down, not computed; see `collection/hooks.server.ts`. `buildPipeline`
   * decides only *which* of them a config runs, from the feature each hook names.
   */
  hooks?: Partial<Record<HookTiming, AnyHook[]>>;

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
   * The REST surface, keyed by sub-path **under `/api/[slug=<name>]`** — `''`, `'[id]'`,
   * `'[id]/duplicate'`. Not an absolute pathname like a plugin's: a prototype has no URL of its
   * own, only slugs the author's config supplies.
   *
   * `dev/codegen/routes/` writes the `+server.ts` files from this and `handlers/routes.server.ts`
   * dispatches through it, so an endpoint exists by being declared here and nowhere else.
   */
  rest?: Record<string, RouteConfig>;
};

export type PrototypeBootArgs<C extends BuiltPrototype = BuiltPrototype> = {
  /** A config of this definition's own kind — boot.server.ts pairs them by name. */
  config: C;
  adapter: Adapter;
  defaultLocale?: string;
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
   * Which **version row** a read means. `undefined` for a config that is not versioned, which is
   * "the document's own row".
   *
   * Pass `intent: 'original'` when loading what an update is about to change — `?draft=true` on an
   * update means "branch a new draft *from what is published*", the opposite of what it means on a
   * read. Defaults to `'read'`.
   *
   * Was `versionQuery`, answered by folding every feature for the one that owns the difference.
   * Only `versions` ever did.
   */
  versionQuery(
    params: { draft?: boolean; versionId?: string },
    intent?: ReadIntent
  ): OperationQuery | undefined;

  /**
   * Read through the API cache when it is on and this is not a system call. `key` is merged on top
   * of what every read shares — the slug and who is asking.
   */
  cached<T>(operation: string, key: Dic, read: () => Promise<T>): Promise<T>;
};

type PrototypeOptions<C extends BuiltPrototype> = Partial<Omit<PrototypeDefinition<C>, 'create'>>;

export const definePrototype = <C extends BuiltPrototype = BuiltPrototype>(
  options: PrototypeOptions<C> = {}
): PrototypeDefinition<C> => {
  const name = options.name ?? '';
  // Defaulted rather than optional: `buildPipeline` filters it on every config, and a prototype
  // with no features is a real case. `hooks` stays optional — a missing timing is already none.
  const augments = options.augments ?? (() => []);

  /**
   * One chain, stated once for every prototype: `_titleFallback` first, then every augment the
   * prototype lists, in the order it lists them — which is column order.
   *
   * It used to be two: the prototype's own augments, then `applyAugments` folding each feature's
   * out of the `features` list and gating it on `FeatureDefinition.enabled`. The list is written
   * out now, guards included — see `prototype/collection/definition.ts`.
   *
   * `_titleFallback` is seeded as `'id'` for every prototype — it was a `titleFallback` field on
   * the definition and both of them answered `'id'`. `auth` and `upload` override it in their own
   * augments, which is where a real preference belongs.
   *
   * No hooks step. A config's pipeline is resolved once the *whole* config exists (see
   * pipelines.server.ts), so a derived config resolves by the same line as an authored one.
   */
  const create = (slug: string, incomingConfig: Dic): C => {
    const initial: Dic = { ...incomingConfig, slug, _titleFallback: 'id' };
    const augmented = augments().reduce((current, augment) => augment(current), initial) as Dic;

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
    augments,
    create,
    hooks: options.hooks,
    boot: options.boot,
    rest: options.rest
  } as PrototypeDefinition<C>;
};
