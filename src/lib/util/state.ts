import { isObjectLiteral } from './object.js';

/**
 * A copy of a state value with its proxies removed: every array and plain object is copied, all
 * the way down; any other value (a Date, a File, a class instance) is kept as it is. A value that
 * holds itself gives a copy that holds itself.
 *
 * @example
 * const reactiveState = { count: 1, nested: { value: 'test' } };
 * const cleanCopy = snapshot(reactiveState); // can be serialized or compared
 */
export const snapshot = <T>(state: T): T => {
  const copies = new Map<object, unknown>();
  const copy = (value: any): any => {
    if (!Array.isArray(value) && !isObjectLiteral(value)) return value;
    if (copies.has(value)) return copies.get(value);
    const output: any = Array.isArray(value) ? [] : {};
    copies.set(value, output);
    for (const [key, item] of Object.entries(value)) output[key] = copy(item);
    return output;
  };
  return copy(state);
};
