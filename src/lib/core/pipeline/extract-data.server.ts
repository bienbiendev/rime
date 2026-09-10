import { RimeFormError } from '$lib/core/errors/index.js';
import type { GenericDoc } from '$lib/core/prototype/types.js';
import { normalizeValue } from '$lib/util/coerce.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { flatten, unflatten } from 'flat';

/**
 * Converts FormData to a structured document object
 * Normalizes form values and handles flattened key structures
 *
 * @example
 * const formData = new FormData();
 * formData.append('user.name', 'John');
 * formData.append('user.active', 'true');
 * const data = formDataToData(formData);
 * // Result: { user: { name: 'John', active: true } }
 */
const formDataToData = (formData: FormData) => {
  const flatData = Object.fromEntries(formData.entries());
  for (const key of Object.keys(flatData)) {
    flatData[key] = normalizeValue(flatData[key]);
  }
  return unflatten(flatData) as GenericDoc;
};

/**
 * Converts a JSON object to a structured document object
 * Normalizes values and ensures consistent data structure
 *
 * @example
 * const jsonData = { user: { name: 'John', active: 'true' } };
 * const data = jsonDataToData(jsonData);
 * // Result: { user: { name: 'John', active: true } }
 */
const jsonDataToData = (jsonData: Dic) => {
  const flatData: Dic = flatten(jsonData);
  for (const key of Object.keys(flatData)) {
    flatData[key] = normalizeValue(flatData[key]);
  }
  return unflatten(flatData) as GenericDoc;
};

/**
 * Turns an incoming request body into document data.
 *
 * Lives in operations/, not rest/: both the REST handlers and the panel's form actions call it,
 * and what it produces is exactly what an operation consumes.
 *
 * Extracts data from a request based on its content type
 * Handles both multipart/form-data, form-urlencoded and JSON requests
 *
 * @example
 * // In a route handler
 * const [error, data] = await trycatch(() => extractData(event.request));
 * if (error) {
 *   return handleError(error, { context: 'api' });
 * }
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
      /** Handle JSON input */
      const jsonData = await request.json();
      data = jsonDataToData(jsonData);
    }
  } catch (err: any) {
    throw new RimeFormError({ _form: err.message });
  }

  return data as T;
};
