import type { Adapter } from '#lib/core/adapter.js';
import type { Access, BuiltArea, BuiltCollection, RouteConfig } from '#lib/core/config/types.js';
import { isStaff } from '#lib/core/auth/access.js';
import type { OperationQuery } from '#lib/core/pipeline/types.js';
import type { Dic } from '#lib/util/types.js';
import FileText from '@lucide/svelte/icons/file-text';
import type { RequestEvent } from '@sveltejs/kit';
import { initial } from './initial.js';
import { prototypeKebab } from './naming.js';

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
 * implementation with a discriminator.
 *
 * A definition carries no config — it is the kind, not an instance. Every config it builds
 * carries its `name` as `type`.
 */
export type BuiltPrototype = BuiltArea | BuiltCollection;

export type PrototypeDefinition<C extends BuiltPrototype = BuiltPrototype> = {
  /** The kind's name, and the `type` every config it builds carries. */
  name: string;

  /**
   * Every augment this prototype runs, in order — its own and its features', one written list.
   *
   * ```ts
   * augments: () => [augmentLabel, when(isAuth, augmentAuth), augmentTitle]
   * ```
   *
   * **A function returning the list, not the list.** Several steps come from `$rime/modules`, and
   * a feature reached through the barrel imports `create` back out of this definition —
   * `auth/staff/configure.ts` and `auth/staff/configure.server.ts` both do. Entered from the
   * feature's side, an array literal captures bindings the barrel has not initialised, and the
   * config builds without those fields: no error, no type change, just a document with no title.
   * Building the list on first `create` reads every binding after every module has finished.
   *
   * `any` because each augment names the shape it needs, and a list holding several cannot
   * promise any of them that shape.
   */
  augments?: () => readonly ((config: any) => any)[];

  /**
   * The config factory. **Composed by `definePrototype`, never passed in**: `augments`, then the
   * shaping every prototype does the same way.
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
   * `dev/codegen/routes/` writes the `+server.ts` files from this and
   * `core/routes/handler.server.ts` dispatches through it, so an endpoint exists by being declared
   * here and nowhere else.
   */
  rest?: Record<string, RouteConfig>;
};

type PrototypeBootArgs<C extends BuiltPrototype = BuiltPrototype> = {
  /** A config of this definition's own kind. */
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

  /**
   * Which **version row** a read means. `undefined` for a config that is not versioned, which is
   * "the document's own row". See `versionsReadQuery`.
   */
  versionQuery(params: { latest?: boolean; versionId?: string }): OperationQuery | undefined;

  /**
   * Read through the API cache when it is on and this is not a system call. `key` is merged on top
   * of what every read shares — the slug and who is asking.
   */
  cached<T>(operation: string, key: Dic, read: () => Promise<T>): Promise<T>;
};

type PrototypeOptions<C extends BuiltPrototype> = Partial<
  Omit<PrototypeDefinition<C>, 'create' | 'name'>
> & { name: string };

/** The rules an author wrote, without the ones written as `undefined`. */
const writtenRules = (access: Dic = {}): Access =>
  Object.fromEntries(Object.entries(access).filter(([, rule]) => rule !== undefined));

export const definePrototype = <C extends BuiltPrototype = BuiltPrototype>(
  options: PrototypeOptions<C>
): PrototypeDefinition<C> => {
  const name = options.name;
  // Defaulted, so `create` calls it unconditionally.
  const augments = options.augments ?? (() => []);

  /**
   * One chain, stated once for every prototype: `_titleFallback` first, then every augment the
   * prototype lists, in the order it lists them — which is column order.
   *
   * `_titleFallback` seeds `'id'`; `auth` and `upload` override it in their own augments, which is
   * where a preference about what names a document belongs.
   *
   * No hooks step. A config's pipeline is resolved once the whole config exists — see
   * `pipeline/build.server.ts` — so a derived config resolves by the same line as an authored one.
   */
  const create = (slug: string, incomingConfig: Dic): C => {
    const seed: Dic = { ...incomingConfig, slug, _titleFallback: 'id' };
    const augmented = augments().reduce((current, augment) => augment(current), seed) as Dic;

    return {
      ...augmented,
      type: name,
      slug,
      initial,
      kebab: prototypeKebab(slug),
      fields: augmented.fields || [],
      icon: augmented.icon || FileText,
      live: augmented.live || false,
      /**
       * Staff-only until the author says otherwise, and the policy is auth's own `isStaff`. A rule
       * written as `undefined` keeps the default.
       */
      access: {
        create: isStaff,
        read: isStaff,
        update: isStaff,
        delete: isStaff,
        ...writtenRules(augmented.access)
      }
    } as C;
  };

  return {
    name,
    augments,
    create,
    boot: options.boot,
    rest: options.rest
  } as PrototypeDefinition<C>;
};
