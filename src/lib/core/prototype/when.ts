import type { Dic } from '#lib/util/types.js';

/**
 * Guards a step with the question that decides whether it applies.
 *
 * ```ts
 * augments: () => [augmentLabel, when(isAuth, augmentAuth), augmentTitle]
 * beforeRead: [when(isAuth, auth.removePrivateFields), processDocumentFields]
 * ```
 *
 * One helper for both lists, because a step is the same shape in both: it takes a thing, and
 * hands back that thing — changed if it applies, untouched if it does not. An augment is handed
 * the config itself; a hook is handed the pipeline's `args`, which carries `config`, and answers
 * with a promise. `carriesConfig` below is the whole of the difference, and `R` is what lets an
 * async step through.
 *
 * The guard sits where the step is placed, so the list says when each step runs. A step with no
 * guard runs always.
 */
export const when = <T, R>(applies: (config: Dic) => boolean, step: (subject: T) => R) => {
  const guarded = (subject: T): R | T =>
    applies(carriesConfig(subject) ? subject.config : (subject as Dic)) ? step(subject) : subject;

  // The guard keeps the step's name, which stack traces read, and `.step` says
  // which step it guards. A function's `name` is non-writable but configurable, so it takes a
  // defineProperty.
  Object.defineProperty(guarded, 'name', { value: step.name, configurable: true });
  return Object.assign(guarded, { step });
};

/** A hook's `args` carries the config; an augment *is* the config, and has no such member. */
const carriesConfig = (subject: unknown): subject is { config: Dic } =>
  typeof subject === 'object' && subject !== null && 'config' in subject;
