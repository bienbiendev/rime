import type { FieldHookDuplicate } from '#lib/fields/types.js';
import { getValueAtPath } from '#lib/util/object.js';

type Context = Parameters<FieldHookDuplicate>[1];

/** How many values a copy tries before the create answers the unique error. */
const MAX_TRIES = 50;

/** Whether a document of the collection holds `value` at `path`, in `locale`. */
const isTaken = async (value: unknown, { event, slug, path, locale }: Context) => {
  const where = { [path]: { equals: value } };
  const found = await event.locals.rime
    .collection(slug)
    .system()
    .find({ locale, query: { where }, select: ['id'] });
  return found.length > 0;
};

/**
 * The value if no document holds it, else the first free `next(source, n)`, `n` from 1, where
 * `source` is the field's value on the source document. An empty value stays as it is.
 *
 * ```ts
 * // 'Sale' and 'Sale (copy)' taken
 * await freeValue('Sale (copy)', context, nextCopy); // 'Sale (copy 2)'
 * ```
 */
export const freeValue = async (
  value: unknown,
  context: Context,
  next: (source: any, n: number) => unknown
) => {
  if (value === undefined || value === null || value === '') return value;

  const source = getValueAtPath(context.path, context.doc);
  const tried = new Set<unknown>([value]);
  let n = 0;
  while (n < MAX_TRIES && (await isTaken(value, context))) {
    // The next numbered value not looked up yet: a title copy already starts at `(copy)`
    do {
      n++;
      value = next(source, n);
    } while (tried.has(value) && n < MAX_TRIES);
    tried.add(value);
  }
  return value;
};
