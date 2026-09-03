import type { HookMark, HookMarks } from './types.js';

/**
 * Computes the order a timing's hooks run in, from what each one declares.
 *
 * The point of the whole thing is what is *absent*: no prototype names a feature, and no feature
 * knows where it sits. A prototype contributes its own hooks, each active feature contributes
 * its own, and the order falls out of `requires`/`provides`. Before this, a collection's
 * `beforeRead` literally read `...featureHooks(upload, collection, 'beforeRead')` — a prototype
 * naming a feature, which is the dependency inversion that made the feature layer decorative.
 *
 * Resolved **once per config at boot**, never per request: the config is static, so a request
 * runs a precomputed array. That is also why there is no attempt to run hooks in parallel — they
 * take `args` and return `{ ...args, doc }`, a fold over one mutating object rather than
 * independent tasks.
 */

/**
 * Reads a hook's marks, filling in for one that never declared any.
 *
 * Marks are attached to the function at runtime rather than carried in its type (see the note on
 * `HookMarks` in types.ts), so this is where the two meet. The fallback is not defensive
 * padding — a hook can reach here without having gone through `Hooks.*` at all, and an
 * unconstrained hook that keeps its input position is the right reading of "said nothing".
 */
export const marksOf = (hook: unknown): HookMarks => {
  const marks = hook as Partial<HookMarks>;
  return {
    name: typeof marks.name === 'string' && marks.name ? marks.name : 'anonymous',
    requires: marks.requires ?? [],
    provides: marks.provides ?? []
  };
};

export type ResolveArgs<T> = {
  /**
   * The hooks to order, already filtered to those active for this config, in tie-break order:
   * the prototype's own first, then each feature's in registry order, then the consumer's.
   *
   * Ordering within a tie is taken from this list rather than computed. Field order is column
   * order elsewhere in this repo, so a resolver that reordered equivalent hooks run to run — or
   * between two configs that declare the same things — would be a real hazard, not a cosmetic
   * one.
   */
  hooks: T[];
  /** Named in errors so a failure says which prototype and timing could not be ordered. */
  label: string;
};

/**
 * Orders one timing's hooks, or throws explaining why it cannot.
 *
 * `requires` means **after every active hook that provides the mark**, not after any one of
 * them. That is the choice that removes the need for a separate notion of phases — `'shaped'`
 * *is* the shape phase — and it is the only way to express a hook that must follow everything
 * which writes to the document without naming what those are: `sortDocumentProps` requires
 * `'document'`, and every writer provides it.
 */
export function resolvePipeline<T>({ hooks, label }: ResolveArgs<T>): T[] {
  const marks = hooks.map(marksOf);
  // Which hooks provide each mark. A mark absent from here is satisfied *vacuously* — see below.
  const providers = new Map<HookMark, Set<number>>();
  hooks.forEach((_hook, index) => {
    for (const mark of marks[index].provides) {
      if (!providers.has(mark)) providers.set(mark, new Set());
      providers.get(mark)!.add(index);
    }
  });

  const blockers = hooks.map((_hook, index) => {
    const set = new Set<number>();
    for (const mark of marks[index].requires) {
      // The vacuous rule: a mark nothing active provides counts as already satisfied.
      //
      // Without it, every unconditional hook that depends on a conditional one would be
      // unsatisfiable on the configs where the conditional hook is absent — `removePrivateFields`
      // exists only when a collection has `auth`, so `requires: ['sanitized']` would break every
      // collection that has none. It also lets one `beforeUpsert` declaration be correct at both
      // its timings: `augmentFieldsPassword` requires `blank-merged` and waits for the merge in
      // `beforeCreate`, while in `beforeUpdate`, where nothing merges, it simply runs free.
      //
      // The cost is that a misspelled mark is silently satisfied rather than reported, which is
      // why `HookMark` is a closed union — a typo has to be a type error, since it cannot be a
      // runtime one.
      for (const provider of providers.get(mark) ?? []) {
        // A hook never waits on itself: a writer that both provides and requires `'document'`
        // is describing the document, not a cycle.
        if (provider !== index) set.add(provider);
      }
    }
    return set;
  });

  const ordered: T[] = [];
  const done = new Set<number>();
  const remaining = hooks.map((_, index) => index);

  while (remaining.length) {
    // The first still-blocked-by-nothing hook, by input position — which is what makes the
    // tie-break stable and the output reproducible.
    const readyAt = remaining.findIndex((index) =>
      [...blockers[index]].every((blocker) => done.has(blocker))
    );

    if (readyAt === -1) {
      // Every remaining hook waits on another remaining hook. Boot-time, and precise about it:
      // the point of declaring requirements rather than discovering them by running is that this
      // is knowable before anything executes.
      const stuck = remaining
        .map((index) => {
          const waitingOn = [...blockers[index]]
            .filter((blocker) => !done.has(blocker))
            .map((blocker) => marks[blocker].name);
          return `  ${marks[index].name} waits on ${waitingOn.join(', ')}`;
        })
        .join('\n');
      throw new Error(
        `${label}: no order satisfies these hooks — they depend on each other in a cycle.\n${stuck}`
      );
    }

    const [index] = remaining.splice(readyAt, 1);
    ordered.push(hooks[index]);
    done.add(index);
  }

  return ordered;
}
