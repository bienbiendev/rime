import type { PrototypeName } from '$lib/core/prototype/registry.server.js';
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
   * What the feature does to the database, which is what tells the adapter whether to generate
   * anything for it:
   *
   * - `augment` — no tables of its own; it only changes a config. The adapter never hears of it.
   * - `shadow` — deviates the prototype's own table (`{base}__versions`).
   * - `child` — a table owned by the prototype's rows (`{base}__$relations`).
   */
  type: 'augment' | 'shadow' | 'child';

  /** The prototypes this feature applies to, by registry name. */
  extends: PrototypeName[];

  /**
   * Features this one is built on top of, by registry name.
   *
   * Also an ordering statement: a feature runs after everything it requires. Rather than sorting
   * by it, the registry *checks* it against the barrel's own order — so the order stays readable
   * in one place, and a barrel that contradicts a `requires` fails loudly at import.
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
   * a companion `<slug>Directories` collection for every upload collection it finds.
   *
   * The same shape a plugin's `configure` has, and it runs in the same place: the config chain in
   * factory/config/build{,.server}.ts, after the prototype factories have built what it reads.
   */
  configure?: (config: any) => any;

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
   * The feature owns the implementations; `operations/pipeline.server.ts` still owns *where they
   * run*, spelled out literally. That split is deliberate: in a collection's `beforeRead` these
   * are interleaved with core steps — `populateURL` must run after the document has been shaped
   * and before it is sorted — and a feature has nothing to say about a core step's position.
   * `requires` cannot express it either, since the features that interleave there require
   * nothing of each other.
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
 * A hook as the registry holds it. Each timing has its own argument shape (see factory/hooks.ts),
 * which a list covering every timing cannot express — the same erasure the prototype registry
 * makes, and sound for the same reason: a hook only ever reaches the timing it is declared under.
 */
export type AnyHook = (args: any) => any;

/**
 * A feature definition as the registry hands it back: the definition plus the name it is exported
 * under. See registry.ts — the name is the barrel key, not a field to keep in sync with it.
 */
export type RegisteredFeature = FeatureDefinition & { name: string };

export const defineFeature = (definition: FeatureDefinition): FeatureDefinition => definition;
