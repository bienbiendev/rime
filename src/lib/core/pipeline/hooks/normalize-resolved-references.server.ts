import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { RimeError } from '#lib/core/errors/index.js';
import { getValueAtPath, isObjectLiteral, setValueAtPath } from '#lib/util/object.js';
import type { Dic } from '#lib/util/types.js';

/**
 * Writes a resolved reference as the id it stores.
 *
 * A read hands the referenced document back, and a save may send it back as it came:
 *
 * ```
 * 'abc'                        'abc'
 * { id: 'abc', name: 'Ann' }   'abc'
 * '', null, { name: 'Ann' }    null
 * 42, { id: 42 }               as sent: validation refuses it
 * ```
 *
 * A pipeline hook rather than a field `$beforeSave`: field hooks are skipped on a locale copy,
 * which still writes the column.
 */
export const normalizeResolvedReferences = Hooks.beforeUpsert(
  async function normalizeResolvedReferences(args) {
    const configMap = args.context.configMap;

    if (!configMap)
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        'missing configMap @normalizeResolvedReferences'
      );

    const paths = Object.entries(configMap)
      .filter(([, config]) => config._references?.resolve)
      .map(([path]) => path);

    return { ...args, data: withReferenceIds({ ...args.data }, paths) };
  }
);

/**
 * `data` with the value at each path written as the id it stores. An absent value is left out.
 *
 * ```ts
 * withReferenceIds({ author: { id: 'u1', name: 'Ann' } }, ['author']); // { author: 'u1' }
 * ```
 */
export const withReferenceIds = (data: Dic, paths: string[]): Dic =>
  paths.reduce((result, path) => {
    const value = getValueAtPath(path, result);
    return value === undefined ? result : setValueAtPath(path, result, toReferenceId(value));
  }, data);

/** The id a reference value names: an id as is, a document's own id, `null` for nothing. */
export const toReferenceId = (value: unknown): unknown => {
  if (value === null || value === '') return null;
  if (isObjectLiteral(value) && typeof value.id === 'string') return value.id || null;
  // A document read without its id names nothing
  if (isObjectLiteral(value) && !('id' in value)) return null;
  // An id, or what validation refuses: 42, { id: 42 }
  return value;
};
