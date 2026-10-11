import { RimeFormError } from '#lib/core/errors/index.js';
import type { GenericDoc } from '#lib/core/prototype/types.js';
import { readFormData } from '#lib/util/form-data.js';
import { isObjectLiteral } from '#lib/util/object.js';
import type { Dic } from '#lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { unflatten } from 'flat';

/** What a hand-written form sends to empty a field: `'null'`, or `'[]'` for a list. */
const readEmpty = (value: unknown) => (value === 'null' ? null : value === '[]' ? [] : value);

/** A hand-written form's entries: one value per key, a list for a key sent several times. */
const handWrittenValues = (formData: FormData): Dic => {
  const values: Dic = {};
  for (const key of new Set(formData.keys())) {
    const all = formData.getAll(key).map(readEmpty);
    values[key] = all.length > 1 ? all : all[0];
  }
  return values;
};

/**
 * FormData to document data. The panel's FormData carries its values as nested JSON, read as
 * they are. A form written by hand sends strings, `user.name` for a nested field, and a key once
 * per value; each field reads its own string before validation.
 *
 * ```ts
 * // a hand-written form with user.name=007, user.active=true, tags=a, tags=b
 * // -> { user: { name: '007', active: 'true' }, tags: ['a', 'b'] }
 * ```
 */
const formDataToData = (formData: FormData) =>
  (readFormData(formData) ?? unflatten(handWrittenValues(formData))) as GenericDoc;

/**
 * Turns an incoming request body (multipart/form-data, form-urlencoded or JSON) into document
 * data. The REST handlers and the panel's form actions both call it.
 *
 * @example
 * // In a route handler: a bad body throws, and handleError answers it
 * const data = await extractData(event.request);
 */
export const extractData = async <T extends Record<string, any>>(
  request: RequestEvent['request']
) => {
  let data;
  try {
    const contentType = request.headers.get('content-type');
    // One branch for both form encodings on purpose: request.formData() decodes
    // multipart/form-data and application/x-www-form-urlencoded alike, per the Fetch spec, so
    // the two only ever differ on the wire.
    const isFormEncoded =
      contentType?.startsWith('multipart/form-data') ||
      contentType?.startsWith('application/x-www-form-urlencoded');
    if (isFormEncoded) {
      /** Handle formData input */
      const formData = await request.formData();
      data = formDataToData(formData);
    } else {
      // A JSON body carries its types and its nesting: taken as it is
      data = await request.json();
    }
  } catch (err: any) {
    throw new RimeFormError({ _form: err.message });
  }
  // A document is an object: `null`, a list or a string names no field
  if (!isObjectLiteral(data)) throw new RimeFormError({ _form: 'The body is not an object' });

  return data as T;
};
