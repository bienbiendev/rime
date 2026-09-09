import type { DocType } from '$lib/core/prototype/types.js';
import type { Hook, HookBeforeOperation, HookMarks, Operation } from './types.js';

/**
 * Helper object for creating hooks with specific operation and timing.
 *
 * Each timing takes **either a bare function or a declaration object**:
 *
 * ```ts
 * Hooks.beforeRead(fn)
 * Hooks.beforeRead({ name: 'setDocumentTitle', run: fn })
 * ```
 *
 * The bare form is the default and what consumers write. The object form exists to give a hook a
 * **name**, which is what the generated pipeline chart shows it under and what a stack trace
 * reports. Where a hook runs is not said here — a prototype's `hooks.server.ts` places it.
 *
 * **Both forms return the function itself**, with the name set on it rather than wrapped around
 * it. `run.server.ts` invokes hooks directly (`await hook({...})`), so anything that returned an
 * object here would break every call site.
 */

/** What a timing's factory accepts: the function, or the function plus its marks. */
type Declaration<H> = H | (Partial<HookMarks> & { run: H });

const declare = <H>(declaration: Declaration<H>): H => {
  const isObject = typeof declaration === 'object' && declaration !== null && 'run' in declaration;
  const run = (isObject ? (declaration as { run: H }).run : declaration) as H & object;
  const marks: Partial<HookMarks> = isObject ? (declaration as Partial<HookMarks>) : {};

  if (marks.feature) Object.assign(run, { feature: marks.feature });

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
  ): HookBeforeOperation<S, Operation> => declare(declaration),

  /** Creates a before read hook */
  beforeRead: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'read', 'before'>>
  ): Hook<S, 'read', 'before'> => declare(declaration),

  /** Creates a before create hook */
  beforeCreate: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'create', 'before'>>
  ): Hook<S, 'create', 'before'> => declare(declaration),

  /**
   * Creates a hook that runs before both create and update.
   *
   * One declaration serving two timings, which the vacuous rule makes correct: a mark nothing
   * active provides counts as satisfied, so `augmentFieldsPassword` can require `blank-merged`
   * and still be right in `beforeUpdate`, where nothing merges a blank document.
   */
  beforeUpsert: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'create' | 'update', 'before'>>
  ): Hook<S, 'create' | 'update', 'before'> => declare(declaration),

  /** Creates a before update hook */
  beforeUpdate: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'update', 'before'>>
  ): Hook<S, 'update', 'before'> => declare(declaration),

  /** Creates a before delete hook */
  beforeDelete: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'delete', 'before'>>
  ): Hook<S, 'delete', 'before'> => declare(declaration),

  /** Creates an after create hook */
  afterCreate: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'create', 'after'>>
  ): Hook<S, 'create', 'after'> => declare(declaration),

  /** Creates a hook that runs after both create and update */
  afterUpsert: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'create' | 'update', 'after'>>
  ): Hook<S, 'create' | 'update', 'after'> => declare(declaration),

  /** Creates an after update hook */
  afterUpdate: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'update', 'after'>>
  ): Hook<S, 'update', 'after'> => declare(declaration),

  /** Creates an after delete hook */
  afterDelete: <S extends DocType = 'raw'>(
    declaration: Declaration<Hook<S, 'delete', 'after'>>
  ): Hook<S, 'delete', 'after'> => declare(declaration)
};
