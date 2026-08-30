import type { DocType } from '$lib/core/types/doc.js';
import type { Hook, HookBeforeOperation, Operation } from './types.js';

/**
 * Helper object for creating hooks with specific operation and timing
 */
export const Hooks = {
  /**
   * Creates a before read hook
   */
  beforeOperation: <S extends DocType = 'raw'>(
    handler: HookBeforeOperation<S, Operation>
  ): HookBeforeOperation<S, Operation> => handler,

  /**
   * Creates a before read hook
   */
  beforeRead: <S extends DocType = 'raw'>(
    handler: Hook<S, 'read', 'before'>
  ): Hook<S, 'read', 'before'> => handler,

  /**
   * Creates a before create hook
   */
  beforeCreate: <S extends DocType = 'raw'>(
    handler: Hook<S, 'create', 'before'>
  ): Hook<S, 'create', 'before'> => handler,

  /**
   * Creates a before upsert hook
   */
  beforeUpsert: <S extends DocType = 'raw'>(
    handler: Hook<S, 'create' | 'update', 'before'>
  ): Hook<S, 'create' | 'update', 'before'> => handler,

  /**
   * Creates a before update hook
   */
  beforeUpdate: <S extends DocType = 'raw'>(
    handler: Hook<S, 'update', 'before'>
  ): Hook<S, 'update', 'before'> => handler,

  /**
   * Creates a before delete hook
   */
  beforeDelete: <S extends DocType = 'raw'>(
    handler: Hook<S, 'delete', 'before'>
  ): Hook<S, 'delete', 'before'> => handler,

  /**
   * Creates an after create hook
   */
  afterCreate: <S extends DocType = 'raw'>(
    handler: Hook<S, 'create', 'after'>
  ): Hook<S, 'create', 'after'> => handler,

  /**
   * Creates an after create hook
   */
  afterUpsert: <S extends DocType = 'raw'>(
    handler: Hook<S, 'create' | 'update', 'after'>
  ): Hook<S, 'create' | 'update', 'after'> => handler,

  /**
   * Creates an after update hook
   */
  afterUpdate: <S extends DocType = 'raw'>(
    handler: Hook<S, 'update', 'after'>
  ): Hook<S, 'update', 'after'> => handler,

  /**
   * Creates an after delete hook
   */
  afterDelete: <S extends DocType = 'raw'>(
    handler: Hook<S, 'delete', 'after'>
  ): Hook<S, 'delete', 'after'> => handler
};
