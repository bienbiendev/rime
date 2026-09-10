import type { DocType } from '$lib/core/prototype/types.js';
import type { Hook, HookBeforeOperation, Operation } from './types.js';

/**
 * Types a hook to its timing. **The argument is the function.**
 *
 * ```ts
 * export const removePrivateFields = Hooks.beforeRead(async function removePrivateFields(args) {
 *   …
 * });
 * ```
 *
 * A **named function expression**, not an arrow: the chart and the order specs read `fn.name`, and
 * an arrow passed as an argument has none.
 *
 * Each timing returns the function untouched — `run.server.ts` calls hooks directly, so a wrapper
 * here would break every call site.
 *
 * Where a hook runs, and whether it applies, are both said where it is placed: a prototype's
 * `hooks.server.ts`.
 */

export const Hooks = {
  /** Creates a before operation hook */
  beforeOperation: <S extends DocType = 'raw'>(
    run: HookBeforeOperation<S, Operation>
  ): HookBeforeOperation<S, Operation> => run,

  /** Creates a before read hook */
  beforeRead: <S extends DocType = 'raw'>(
    run: Hook<S, 'read', 'before'>
  ): Hook<S, 'read', 'before'> => run,

  /** Creates a before create hook */
  beforeCreate: <S extends DocType = 'raw'>(
    run: Hook<S, 'create', 'before'>
  ): Hook<S, 'create', 'before'> => run,

  /** A hook that runs before both create and update — `augmentFieldsPassword` is the one. */
  beforeUpsert: <S extends DocType = 'raw'>(
    run: Hook<S, 'create' | 'update', 'before'>
  ): Hook<S, 'create' | 'update', 'before'> => run,

  /** Creates a before update hook */
  beforeUpdate: <S extends DocType = 'raw'>(
    run: Hook<S, 'update', 'before'>
  ): Hook<S, 'update', 'before'> => run,

  /** Creates a before delete hook */
  beforeDelete: <S extends DocType = 'raw'>(
    run: Hook<S, 'delete', 'before'>
  ): Hook<S, 'delete', 'before'> => run,

  /** Creates an after create hook */
  afterCreate: <S extends DocType = 'raw'>(
    run: Hook<S, 'create', 'after'>
  ): Hook<S, 'create', 'after'> => run,

  /** Creates a hook that runs after both create and update */
  afterUpsert: <S extends DocType = 'raw'>(
    run: Hook<S, 'create' | 'update', 'after'>
  ): Hook<S, 'create' | 'update', 'after'> => run,

  /** Creates an after update hook */
  afterUpdate: <S extends DocType = 'raw'>(
    run: Hook<S, 'update', 'after'>
  ): Hook<S, 'update', 'after'> => run,

  /** Creates an after delete hook */
  afterDelete: <S extends DocType = 'raw'>(
    run: Hook<S, 'delete', 'after'>
  ): Hook<S, 'delete', 'after'> => run
};
