import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { RimeError } from '$lib/core/errors/index.js';
import { getValueAtPath, setValueAtPath } from '$lib/util/object.js';

/**
 * Writes a resolved reference as the id it stores.
 *
 * A read hands the referenced document back, and a save may send it back as it came:
 *
 * ```
 * 'abc'                        'abc'
 * { id: 'abc', name: 'Ann' }   'abc'
 * '', null, { name: 'Ann' }    null
 * ```
 *
 * A pipeline hook rather than a field `$beforeSave`: field hooks are skipped on the
 * locale-fallback pass and under `?skipValidation`, and both still write the column.
 */
export const normalizeResolvedReferences = Hooks.beforeUpsert(
  async function normalizeResolvedReferences(args) {
    const configMap = args.context.configMap;

    if (!configMap)
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        'missing configMap @normalizeResolvedReferences'
      );

    let data = { ...args.data };
    for (const [path, config] of Object.entries(configMap)) {
      if (!config._references?.resolve) continue;
      const value = getValueAtPath(path, data);
      if (value === undefined) continue;
      data = setValueAtPath(path, data, toReferenceId(value));
    }

    return { ...args, data };
  }
);

export const toReferenceId = (value: unknown): string | null => {
  if (typeof value === 'string') return value || null;
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
};
