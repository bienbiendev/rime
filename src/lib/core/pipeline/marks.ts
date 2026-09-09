/**
 * Which mark names are legal, and who owns each namespace.
 *
 * A mark is satisfied *vacuously* when nothing active provides it — that is the rule that lets an
 * unconditional hook depend on a conditional one, and it is not going away. Its cost is that a
 * name nobody provides is indistinguishable from a name nobody spelled correctly: both are
 * "already satisfied", both reorder the pipeline, and neither says anything.
 *
 * So every mark carries its owner, and one rule covers all of them:
 *
 *   core:shaped          the pipeline's own vocabulary
 *   versions:operation   a feature's
 *   collection:…         a prototype's — available, nothing needs one today
 *   app:priced           a consumer's
 *
 * `core` is reserved. Everything else is whoever is speaking, which is what stops two owners
 * reaching independently for the same obvious word — `session`, `ready` — and silently joining
 * one set instead of colliding.
 *
 * **Nothing writes a mark as a string.** `HOOK_MARKS` below is where core's live, a feature
 * declares its own beside itself (`features/versions/marks.ts`), and `CoreHookMark` is *derived*
 * from this object rather than restated — so there is no second list to drift from.
 */

/** The owner name reserved for rime's own pipeline. */
export const CORE_MARK_OWNER = 'core';

/** What separates an owner from its mark name. */
export const MARK_SEPARATOR = ':';

/**
 * Core's marks — the points in a pipeline's progress that core itself names.
 *
 * Owned by core, provided by whoever reaches them: `core:document` is provided by every hook that
 * writes a document property, most of which are features'. Owning a mark is stating that the
 * point exists, not claiming to be the one that gets there.
 */
export const HOOK_MARKS = {
  /** Private fields are gone; anything deriving from the document may now read it. */
  SANITIZED: 'core:sanitized',
  /** Field values have been processed into their final document shape. */
  SHAPED: 'core:shaped',
  /** The document's own title has been resolved. */
  TITLE: 'core:title',
  /**
   * Anything that writes a document property declares this, so a hook that must run after every
   * writer — `sortDocumentProps` — can wait on all of them without naming one.
   */
  DOCUMENT: 'core:document',
  /**
   * Every hook that reads the caller's submission *as sent* has run, so hooks may now add to
   * `data`.
   *
   * The write-side twin of `SANITIZED`, and it exists because the auth guards are not merely early
   * by taste: `preventUserMutations` rejects on `'name' in args.data` and
   * `preventSuperAdminMutation` on `'isSuperAdmin' in args.data`, so a default filled in before
   * them turns an ordinary update into a 401.
   */
  DATA_INSPECTED: 'core:data-inspected',
  /** The blank document has been merged in, so `config.fields` is the final field list. */
  BLANK_MERGED: 'core:blank-merged',
  /** `config.fields` is final and may be read to build a config map. */
  CONFIG_FIELDS: 'core:config-fields',
  /** The config map for incoming data exists. */
  CONFIG_MAP: 'core:config-map',
  /** The original document has been loaded. */
  ORIGINAL_DOC: 'core:original-doc',
  /**
   * The row this document's content lives on has been named.
   *
   * Core provides the default — the document's own row — so a feature that moves the content
   * elsewhere requires this and answers again, rather than every prototype having to list that
   * feature's hook to make the answer exist at all.
   */
  CONTENT_OWNER: 'core:content-owner',
  /** The config map for the original document exists. */
  ORIGINAL_CONFIG_MAP: 'core:original-config-map',
  /** Incoming data has been validated. */
  VALIDATED: 'core:validated'
} as const;

const CORE_MARK_VALUES: ReadonlySet<string> = new Set(Object.values(HOOK_MARKS));

/** Why a mark name is not legal, or `undefined` when it is. */
export const markProblem = (mark: string): string | undefined => {
  const separator = mark.indexOf(MARK_SEPARATOR);

  if (separator < 1 || separator === mark.length - 1) {
    return `"${mark}" is not "owner${MARK_SEPARATOR}name" — every mark says who owns it, so two owners cannot reach for the same word and silently share it`;
  }

  // A name in core's namespace that core does not have is a misspelling, and the vacuous rule
  // would otherwise swallow it.
  if (mark.slice(0, separator) === CORE_MARK_OWNER && !CORE_MARK_VALUES.has(mark)) {
    return `"${mark}" is in the reserved "${CORE_MARK_OWNER}" namespace but is not one of core's marks — a misspelling, or a name that wants your own owner instead`;
  }

  return undefined;
};

/**
 * Throws unless every mark these hooks declare is legal.
 *
 * Boot-time, beside the cycle check and for the same reason: what a hook declares is knowable
 * before anything runs, and the alternative to throwing here is a pipeline that runs in an order
 * nobody chose.
 *
 * It has to exist even though `HookMark` is a closed union, because `FeatureHookMarks` declaration
 * merging is a hole in that union: anything reaching it can put any string in, and a consumer's
 * hooks go into the same array the resolver orders.
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
