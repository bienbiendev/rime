/**
 * String-to-value coercion for data arriving over the wire.
 *
 * Pure: every type in here is a language primitive, which is why it sits in util/ while the
 * request parsing that uses it stays in core/operations.
 */
/**
 * Normalizes string values to appropriate types
 * Converts 'true'/'false' strings to boolean values
 * Handles null values and numeric conversions
 */
export const normalizeValue = (value: any) => {
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
