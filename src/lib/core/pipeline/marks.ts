/**
 * Which mark names are legal, and who owns each namespace.
 *
 * A mark is satisfied *vacuously* when nothing active provides it — that is the rule that lets an
 * unconditional hook depend on a conditional one, and it is not going away. Its cost is that a
 * name nobody provides is indistinguishable from a name nobody spelled correctly: both are
 * "already satisfied", both reorder the pipeline, and neither says anything.
 *
 * `HookMark` being a closed union caught that for **this** repo's own hooks. It does not catch it
 * for a consumer, who reaches the same union through declaration merging and can put any string
 * in it — including one rime already uses. A config that merged `'shaped'` would not collide
 * loudly; it would join the set of hooks providing rime's shape mark and quietly move whatever
 * waits on it.
 *
 * So mark names are namespaced, and the namespace is checked at boot:
 *
 * - `__name` — **rime's**, and a closed list. Anything else starting `__` is a typo.
 * - `owner:name` — anyone else's. A plugin, a consumer's own config, a third-party feature.
 *   Namespaced by whoever owns it, so two of them cannot collide by accident either.
 *
 * Any other shape throws. That is the point: a bare `'session'` reads like a name a second person
 * would also reach for, and the failure it causes is silent.
 */

/** What marks a rime-owned mark. Reserved: nothing outside this repo may use it. */
export const RIME_MARK_PREFIX = '__';

/** What separates an owner from its mark name, for everyone else. */
export const OWNED_MARK_SEPARATOR = ':';

/**
 * Every mark rime owns, at runtime.
 *
 * The twin of `CoreHookMark` in types.ts, and it has to be written twice: the union is what makes
 * a misspelling a *compile* error inside this repo, and this list is what makes it a *boot* error
 * for anything that reached the union through declaration merging. `marks.spec.ts` asserts the
 * two agree, so neither can drift.
 */
export const RIME_MARKS = [
  '__sanitized',
  '__shaped',
  '__title',
  '__document',
  '__data-inspected',
  '__blank-merged',
  '__config-fields',
  '__config-map',
  '__original-doc',
  '__content-owner',
  '__original-config-map',
  '__validated'
] as const;

const RIME_MARK_SET: ReadonlySet<string> = new Set(RIME_MARKS);

/** Why a mark name is not legal, or `undefined` when it is. */
export const markProblem = (mark: string): string | undefined => {
  if (mark.startsWith(RIME_MARK_PREFIX)) {
    return RIME_MARK_SET.has(mark)
      ? undefined
      : `"${mark}" starts with the reserved "${RIME_MARK_PREFIX}" prefix but is not a rime mark — a misspelling, or a name that wants an owner prefix instead`;
  }

  if (mark.includes(OWNED_MARK_SEPARATOR)) {
    const [owner, ...rest] = mark.split(OWNED_MARK_SEPARATOR);
    return owner && rest.join(OWNED_MARK_SEPARATOR)
      ? undefined
      : `"${mark}" is missing one half of "owner${OWNED_MARK_SEPARATOR}name"`;
  }

  return `"${mark}" has no namespace — rime's own marks start with "${RIME_MARK_PREFIX}", and everyone else's are "owner${OWNED_MARK_SEPARATOR}name" so two of them cannot collide`;
};

/**
 * Throws unless every mark these hooks declare is legal.
 *
 * Boot-time, beside the cycle check and for the same reason: what a hook declares is knowable
 * before anything runs, and the alternative to throwing here is a pipeline that runs in an order
 * nobody chose.
 */
export const assertMarks = (
  hooks: { name: string; requires: readonly string[]; provides: readonly string[] }[],
  label: string
): void => {
  const problems = hooks.flatMap((hook) =>
    [...hook.requires, ...hook.provides]
      .map(markProblem)
      .filter((problem): problem is string => !!problem)
      .map((problem) => `  ${hook.name}: ${problem}`)
  );

  if (problems.length) {
    throw new Error(`${label}: illegal hook marks.\n${[...new Set(problems)].join('\n')}`);
  }
};
