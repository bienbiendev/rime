import type { RegisteredPrototype } from '$lib/core/prototype/define.js';
import type { Dic } from '$lib/util/types.js';

/**
 * A feature **augments and extends** what a prototype defines.
 *
 * The middle of the three layers — a prototype *defines* the base thing, a feature augments and
 * extends it at large scale (across prototypes, adding shadows and children), a plugin augments
 * at small scale. See docs/architecture-target.md.
 *
 * What a feature owns is its whole vertical: the fields it adds to a config, the hooks that make
 * those fields mean something, and (for `shadow`/`child`) the tables it asks the adapter for.
 * What it does *not* own is where its document hooks sit in the pipeline — see `hooks` below.
 *
 * Only the parts a feature in this repo actually uses are declared here. The doc lists more
 * (`configure`, `beforeBoot`, `afterBoot`, `beforeCodegen`, `afterCodegen`, `persistence`,
 * `transform`); each lands with the feature that first needs it, rather than being designed
 * against a case nobody can name yet.
 */
export type FeatureDefinition = {
  /**
   * The feature's name, used to identify it in the generated pipeline and to deduplicate the
   * whole-config steps (`configure`, `boot`) when several prototypes list the same feature.
   *
   * Explicit, where it used to be the registry barrel's key. There is no barrel any more — a
   * prototype names the features that extend it, by value — so nothing is left to infer a name
   * from. Same reason a hook declares its own: the thing is passed as an argument, and an
   * argument has no name.
   */
  name: string;

  /**
   * What the feature does to the database, which is what tells the adapter whether to generate
   * anything for it:
   *
   * - `augment` — no tables of its own; it only changes a config. The adapter never hears of it.
   * - `shadow` — deviates the prototype's own table (`{base}__versions`).
   * - `child` — a table owned by the prototype's rows (`{base}__$relations`).
   */
  type: 'augment' | 'shadow' | 'child';

  /**
   * Features this one is built on top of, by name.
   *
   * Also an ordering statement: a feature runs after everything it requires. Rather than sorting
   * by it, `definePrototype` *checks* it against the order the prototype listed — so the order
   * stays readable where it is declared, and a list that contradicts a `requires` fails loudly.
   */
  requires: string[];

  /**
   * Whether a given config uses this feature.
   *
   * One place to say it. It used to be repeated: `augmentUrl` tested `config.$url` internally
   * and the pipeline tested it again at each hook site.
   */
  enabled: (config: Dic) => boolean;

  /**
   * What the feature adds to a config of a prototype it extends — fields, mostly.
   *
   * Runs inside the prototype factories, in barrel order, only for configs where `enabled`.
   *
   * `any` rather than `Dic`, and for a real reason: each augment names the shape it needs
   * (`{ slug, nested?, fields? }`, `Collection<any>`), and a parameter is contravariant, so a
   * list that accepts every feature's augment cannot promise any of them a shape. The same
   * erasure `AnyHook` makes below, sound for the same reason — an augment only ever sees configs
   * of a prototype it declared in `extends`. What the augments do to a config's *type* is
   * declared in registry.ts, where the factories can see it.
   */
  augment?: (config: any) => any;

  /**
   * What the feature adds to the *whole* config, rather than to one prototype's — upload derives
   * a companion `<slug>Directories` collection for every upload collection it finds, auth adds the
   * `staff` collection, the panel fills in its defaults.
   *
   * It runs in the config chain (`core/config/build{,.server}.ts`), through
   * `configureWithFeatures`. What it does to the config's *type* is declared in register.ts.
   *
   * **The prototypes come as an argument, and that is not a convenience.** A step that derives a
   * prototype config needs that prototype's `features` to build its hooks, and importing the
   * definition to get them is the back-edge rule 3 forbids: a definition lists its features by
   * value, so a feature reaching back for the definition can be evaluated *from inside* it and
   * capture `undefined` for whichever feature is still in flight — which is exactly what
   * `versions` did the moment its derive step became a `configure`. Handed the registry instead,
   * a feature imports no definition at all.
   */
  configure?: (config: any, prototypes: RegisteredPrototype[]) => any;

  /**
   * Run once per process, before anything is served — the feature's own boot step.
   *
   * Takes the whole config, not one prototype's, which is why it is not a timing in `hooks`
   * below: a hook's timing is defined by the arguments available at it, and this one is answering
   * a question about the config as a whole ("does anything here upload?"). Mirrors
   * `PrototypeDefinition.boot`.
   */
  boot?: (config: any) => void | Promise<void>;

  /**
   * The feature's document hooks, by timing.
   *
   * The feature owns the implementations; it does not own where they run. There is no
   * `pipeline.server.ts` spelling that out any more — each hook declares `requires`/`provides`
   * and `resolve-pipeline.server.ts` sorts them (see core/pipeline/hooks.ts). That is what the
   * literal lists could not do: in a collection's `beforeRead` a feature's hooks interleave with
   * core steps — `populateURL` must run after the document is shaped and before it is sorted —
   * and the features that interleave there require nothing of *each other*, so their order was
   * not expressible as a dependency between features.
   *
   * A plain value, assigned the way every other hook in the repo is. It briefly also accepted a
   * thunk, because the `$rime/modules` barrel evaluated a feature inside an import cycle and a
   * binding read at module scope could be `undefined`. The barrel is gone — imports are rewritten
   * per name, so a feature pulls in the one pair it names — and the thunk went with it rather
   * than staying on as an escape hatch: a second way to declare one thing, whose reason no
   * longer exists.
   */
  hooks?: FeatureHooks;
};

export type FeatureHooks = Partial<Record<HookTiming, AnyHook[]>>;

export type HookTiming =
  | 'beforeOperation'
  | 'beforeRead'
  | 'beforeCreate'
  | 'afterCreate'
  | 'beforeUpdate'
  | 'afterUpdate'
  | 'beforeDelete'
  | 'afterDelete';

/**
 * A hook as the registry holds it. Each timing has its own argument shape (see
 * core/pipeline/hooks.ts), which a list covering every timing cannot express — the same erasure the prototype registry
 * makes, and sound for the same reason: a hook only ever reaches the timing it is declared under.
 */
export type AnyHook = (args: any) => any;

/** Kept as an alias while call sites migrate: a feature now carries its own name. */
export type RegisteredFeature = FeatureDefinition;

/**
 * Generic in the *name only*, so `name` survives as a literal — which is what lets a prototype's
 * `features` list yield an ordered tuple of names for the type fold.
 *
 * Not `<const D extends FeatureDefinition>`: that also freezes every array literal in the
 * definition into a fixed-length tuple, so `hooks.beforeRead` typed as `[Hook]` and refused a
 * plain `Hook[]`.
 */
export const defineFeature = <N extends string>(
  definition: FeatureDefinition & { name: N }
): FeatureDefinition & { name: N } => definition;
