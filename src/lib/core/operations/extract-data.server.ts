import { RimeFormError } from '$lib/core/errors/index.js';
import type { GenericDoc } from '$lib/core/types/doc.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { flatten, unflatten } from 'flat';

/**
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
    const isMultiPartFormData = contentType?.startsWith('multipart/form-data');
    const isFormURLEncoded = contentType?.startsWith('application/x-www-form-urlencoded');
    if (isMultiPartFormData || isFormURLEncoded) {
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
export const formDataToData = (formData: FormData) => {
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
export const jsonDataToData = (jsonData: Dic) => {
  const flatData: Dic = flatten(jsonData);
  for (const key of Object.keys(flatData)) {
    flatData[key] = normalizeValue(flatData[key]);
  }
  return unflatten(flatData) as GenericDoc;
};

/**
 * Normalizes string values to appropriate types
 * Converts 'true'/'false' strings to boolean values
 * Handles null values and numeric conversions
 */
const normalizeValue = (value: any) => {
  if (value === 'false' || value === 'true') {
    return value === 'true';
  }
  if (value === 'null') {
    return null;
  }
  if (value === 'undefined') {
    return undefined;
  }
  if (value === '[]') {
    return [];
  }
  // For time values return raw value
  if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
    return value;
  }
  // For integers parseInt
  if (/^[\d]+$/.test(value)) {
    return parseInt(value);
  }
  // For floats parseFloat
  if (/^[\d]+\.[\d]+$/.test(value)) {
    return parseFloat(value);
  }
  return value;
};
