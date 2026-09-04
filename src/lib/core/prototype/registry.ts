import type { Dic } from '$lib/util/types.js';
import type { BuiltPrototype, PrototypeDefinition, RegisteredPrototype } from './define.js';
import type { ApplyPrototypeConfigure } from './register.js';
import { area } from './area/index.js';
import { collection } from './collection/index.js';

/**
 * Every prototype's name, in the order the whole-config steps fold them.
 *
 * A tuple rather than `keyof typeof protos`, because `ApplyPrototypeConfigure` needs the order and
 * `keyof` gives an unordered union. It cannot drift from the object below: `protos` is annotated
 * `Record<PrototypeName, …>`, so a prototype added there without a name here is an excess
 * property, and a name here with no entry there is a missing one.
 */
export const prototypeNames = ['collection', 'area'] as const;

export type PrototypeName = (typeof prototypeNames)[number];

/**
 * The prototype registry, isomorphic half.
 *
 * A definition's **name is its export name here**, so there is no field to keep in sync with the
 * key, and adding a kind is adding a folder and an export.
 *
 * It lives on the isomorphic side because a definition is a `$rime/modules` pair: a client build
 * gets the half without `api` and `rest`. The config factory runs on both sides and needs each
 * prototype's `features` list, so that list has to be reachable from a client build.
 */
export const protos: Record<PrototypeName, PrototypeDefinition> = { collection, area };

export { area, collection };

/**
 * Every registered prototype. What the whole-config feature steps iterate.
 *
 * **Annotated, not inferred**, and that is load-bearing — the same rule `Rime` follows in
 * rime.server.ts. `augmentConfig` passes this list to `configureWithFeatures`, so inferring it
 * would make `BuildConfig` depend on each definition's `features`, hence on every feature's hooks,
 * each of which is typed through `event.locals.rime` → `Rime` → `BuildConfig`. That closes the
 * loop and TypeScript answers `any` for all of them. A declared type is resolved lazily by name,
 * so the loop never forms.
 */
export const prototypes: RegisteredPrototype[] = Object.entries(protos).map(
  // As registry.server.ts: each definition is written against its own config kind and a list
  // cannot hold both and stay iterable.
  ([name, definition]) => ({ ...(definition as PrototypeDefinition), name })
);

/**
 * Runs every prototype's `configure` over the whole config — the prototype twin of
 * `configureWithFeatures`.
 *
 * Folded over `prototypeNames`, so one declaration fixes the order at runtime and in the type.
 * `ApplyPrototypeConfigure` replays that order, which matters for any transform that is not
 * merely additive.
 */
export const configureWithPrototypes = <T extends Dic>(
  config: T
): ApplyPrototypeConfigure<T, typeof prototypeNames> =>
  prototypeNames.reduce(
    (current: Dic, name) => (protos[name].configure ? protos[name].configure(current) : current),
    config
  ) as ApplyPrototypeConfigure<T, typeof prototypeNames>;

/**
 * Every prototype config a built config carries, in registry order.
 *
 * The fold that replaces `[...config.collections, ...config.areas]`: each prototype declares the
 * member its instances are authored under, so a caller iterating "every prototype in this config"
 * names no kind and a third prototype costs nothing.
 */
export const prototypeConfigs = <T extends BuiltPrototype = BuiltPrototype>(config: Dic): T[] =>
  prototypeEntries<T>(config).map((entry) => entry.config);

/**
 * The same fold, but each config still paired with the prototype that defines it.
 *
 * For the callers that need something off the definition rather than off the instance — the
 * features that extend it, above all, which is how a shadow is found without asking a config
 * whether it has a `versions` member.
 */
export const prototypeEntries = <T extends BuiltPrototype = BuiltPrototype>(
  config: Dic
): { prototype: PrototypeDefinition; config: T }[] =>
  prototypeNames.flatMap((name) =>
    (((config[protos[name].configKey] as T[] | undefined) ?? []) as T[]).map((prototypeConfig) => ({
      prototype: protos[name],
      config: prototypeConfig
    }))
  );
