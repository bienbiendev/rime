import type { Adapter } from '$lib/core/adapter/types.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/factory/config/types.js';

/**
 * A prototype is a `base` table. Everything else about it is a flag.
 *
 * docs/architecture-target.md states it as: *"An area is a prototype, singleton on — create and
 * delete off. A collection is a prototype, singleton off."* So there is one definition, and the
 * two kinds are the same call with different options:
 *
 * ```ts
 * const collection = definePrototype();
 * const area = definePrototype({ singleton: true });
 * ```
 *
 * The point is what stops being written twice. `isArea` / `isCollection` / `type === 'area'`
 * appears 65 times across 34 files, and each one is a place where the two kinds were told apart
 * by name rather than by the property actually being asked about. A caller that wants to know
 * whether there is one row or many asks `singleton`; nothing else needs to know which kind it
 * is holding.
 *
 * A definition carries no config. It is the *kind*, not an instance of it — the configs come
 * from the user and are matched to a definition by `type`.
 */
export type BuiltPrototype = BuiltArea | BuiltCollection;

export type PrototypeDefinition<C extends BuiltPrototype = BuiltPrototype> = {
  /**
   * Whether exactly one document exists.
   *
   * On: create and delete are not operations (a second row is not a thing, and removing the only
   * one leaves nothing to read), reads and updates take no id, and the row has to exist before
   * runtime — hence `boot`.
   */
  singleton: boolean;

  /**
   * Run once per process, per config of this kind. The prototype's own boot hook: what a kind
   * needs doing before any request can be served.
   */
  boot?: (args: PrototypeBootArgs<C>) => Promise<void>;
};

export type PrototypeBootArgs<C extends BuiltPrototype = BuiltPrototype> = {
  /** A config of this definition's own kind — boot.server.ts pairs them by name. */
  config: C;
  adapter: Adapter;
  defaultLocale?: string;
};

/**
 * A prototype definition as the registry hands it back: the definition plus the name it is
 * exported under. See extensions/index.ts — the name is the barrel key, not a field somebody has
 * to keep in sync with it.
 */
export type RegisteredPrototype = PrototypeDefinition & { name: string };

export const definePrototype = <C extends BuiltPrototype = BuiltPrototype>(
  options: Partial<PrototypeDefinition<C>> = {}
): PrototypeDefinition<C> => ({
  singleton: options.singleton ?? false,
  boot: options.boot
});
