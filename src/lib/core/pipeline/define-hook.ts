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
 * It used to take `{ name, feature, run }`, and set `name` on the function and `feature` beside
 * it. Both are gone: `feature` was how `buildPipeline` decided which hooks a config runs, and the
 * guard sits beside the hook in the prototype's list now (`when(isAuth, …)`); `name` was needed
 * because an arrow passed as an argument gets none — a **named function expression** gets its
 * own, which is what the hooks are written as.
 *
 * Each timing returns the function untouched. `run.server.ts` invokes hooks directly
 * (`await hook({…})`), so anything returning a wrapper here would break every call site.
 *
 * Where a hook runs is not said here — a prototype's `hooks.server.ts` places it.
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
