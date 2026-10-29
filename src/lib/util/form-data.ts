import type { Dic } from './types.js';

/** The FormData entry that carries a form's values as JSON. */
const FORM_JSON_ENTRY = '_data';

/**
 * A document's values to FormData: a file at the top level as an entry of its own, everything
 * else as one JSON entry, nested as it is, so `'2024'` stays a string and `4` a number.
 *
 * ```ts
 * writeFormData({ title: '2024', meta: { priority: 4 }, file: photo })
 * // _data = '{"title":"2024","meta":{"priority":4}}', file = photo
 * ```
 */
export const writeFormData = (values: Dic) => {
  const formData = new FormData();
  const json: Dic = {};
  for (const [key, value] of Object.entries(values)) {
    if (value instanceof File) {
      formData.set(key, value);
    } else {
      json[key] = value;
    }
  }
  formData.set(FORM_JSON_ENTRY, JSON.stringify(json));
  return formData;
};

/**
 * The values `writeFormData` wrote: the `_data` JSON, with every other entry of the FormData set
 * on top of it (a file, or a string that then replaces the JSON value of the same key). `null`
 * for a FormData with no `_data`.
 *
 * ```ts
 * readFormData(writeFormData({ title: '2024', file: photo })) // { title: '2024', file: photo }
 * ```
 */
export const readFormData = (formData: FormData): Dic | null => {
  const { [FORM_JSON_ENTRY]: json, ...files } = Object.fromEntries(formData.entries());
  if (typeof json !== 'string') return null;
  return { ...JSON.parse(json), ...files };
};
