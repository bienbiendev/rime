import type { DocType } from '$lib/core/prototype/types.js';
import type { Hook, HookBeforeOperation, HookMarks, Operation } from '../operations/types.js';

/**
 * Helper object for creating hooks with specific operation and timing.
 *
 * Each timing takes **either a bare function or a declaration object**:
 *
 * ```ts
 * Hooks.beforeRead(fn)
 * Hooks.beforeRead({ name: 'setDocumentTitle', requires: ['shaped'], provides: ['title'], run: fn })
 * ```
 *
 * The bare form is the one consumers write and the one every hook used before ordering became
 * declared, so it stays the default. The object form is how a hook says where it belongs — see
 * `HookMark` in operations/types.ts, and `resolve-pipeline.server.ts` for what is done with it.
 *
 * **Both forms return the function itself**, with the marks attached as properties rather than
 * wrapped around it. `run.server.ts` invokes hooks directly (`await hook({...})`), so anything
 * that returned an object here would break every call site; this way the resolver is the only
 * thing that ever looks at the marks.
 */

/** What a timing's factory accepts: the function, or the function plus its marks. */
type Declaration<H> = H | (Partial<HookMarks> & { run: H });

/**
 * Marks a hook carries when it does not declare its own.
 *
 * Not empty on purpose. A hook with no requirements would sort to the front, which is wrong for
 * the common case — a consumer's `beforeRead` hook wants to see a shaped document, and anything
 * that touches the document should be waited on by `sortDocumentProps`. These defaults put an
 * undeclared hook where an author would expect it, which for a `beforeRead` is also *later* than
 * the old code put it: consumer hooks used to be appended after `sortDocumentProps`, leaving any
 * property they added unsorted.
 */
const DEFAULTS: Record<string, Pick<HookMarks, 'requires' | 'provides'>> = {
  beforeOperation: { requires: [], provides: [] },
  beforeRead: { requires: ['shaped'], provides: ['document'] },
  beforeCreate: { requires: ['validated'], provides: [] },
  beforeUpdate: { requires: ['validated'], provides: [] },
  beforeDelete: { requires: [], provides: [] },
  afterCreate: { requires: [], provides: [] },
  afterUpdate: { requires: [], provides: [] },
  afterDelete: { requires: [], provides: [] }
};

const declare = <H>(timing: string, declaration: Declaration<H>): H => {
  const isObject = typeof declaration === 'object' && declaration !== null && 'run' in declaration;
  const run = (isObject ? (declaration as { run: H }).run : declaration) as H & object;
  const marks: Partial<HookMarks> = isObject ? (declaration as Partial<HookMarks>) : {};

  Object.assign(run, {
    requires: marks.requires ?? DEFAULTS[timing].requires,
    provides: marks.provides ?? DEFAULTS[timing].provides
  });

  // `name` cannot go through Object.assign: a function's own `name` is non-writable, so
  // assigning to it throws a TypeError in strict mode, which every ES module is. It *is*
  // configurable, so defineProperty works — and it sets the function's real name, so the hook
  // shows up under it in stack traces too rather than as an anonymous arrow.
  Object.defineProperty(run, 'name', {
    value: marks.name ?? 'anonymous',
    configurable: true
  });

  return run as H;
};

export const Hooks = {
  /** Creates a before operation hook */
  beforeOperation: <S extends DocType = 'raw'>(
    declaration: Declaration<HookBeforeOperation<S, Operation>>
  ): HookBeforeOperation<S, Operation> => declare('beforeOperation', declaration),

  /** Creates a before read hook */
  beforeRead: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'read', 'before'>>
  ): Hook<S, 'read', 'before'> => declare('beforeRead', declaration),

  /** Creates a before create hook */
  beforeCreate: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'create', 'before'>>
  ): Hook<S, 'create', 'before'> => declare('beforeCreate', declaration),

  /**
   * Creates a hook that runs before both create and update.
   *
   * One declaration serving two timings, which the vacuous rule makes correct: a mark nothing
   * active provides counts as satisfied, so `augmentFieldsPassword` can require `blank-merged`
   * and still be right in `beforeUpdate`, where nothing merges a blank document.
   */
  beforeUpsert: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'create' | 'update', 'before'>>
  ): Hook<S, 'create' | 'update', 'before'> => declare('beforeCreate', declaration),

  /** Creates a before update hook */
  beforeUpdate: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'update', 'before'>>
  ): Hook<S, 'update', 'before'> => declare('beforeUpdate', declaration),

  /** Creates a before delete hook */
  beforeDelete: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'delete', 'before'>>
  ): Hook<S, 'delete', 'before'> => declare('beforeDelete', declaration),

  /** Creates an after create hook */
  afterCreate: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'create', 'after'>>
  ): Hook<S, 'create', 'after'> => declare('afterCreate', declaration),

  /** Creates a hook that runs after both create and update */
  afterUpsert: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'create' | 'update', 'after'>>
  ): Hook<S, 'create' | 'update', 'after'> => declare('afterCreate', declaration),

  /** Creates an after update hook */
  afterUpdate: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'update', 'after'>>
  ): Hook<S, 'update', 'after'> => declare('afterUpdate', declaration),

  /** Creates an after delete hook */
  afterDelete: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'delete', 'after'>>
  ): Hook<S, 'delete', 'after'> => declare('afterDelete', declaration)
};
