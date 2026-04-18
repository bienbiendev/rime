import type { Dic } from '$lib/util/types.js';

/**
 * Creates a deep copy of a state object, removing any proxies or reactive wrappers.
 * Useful for getting a clean snapshot of reactive state that can be serialized or compared.
 *
 * @example
 * // Get a clean snapshot of a reactive state object
 * const reactiveState = { count: 1, nested: { value: 'test' } };
 * const cleanCopy = snapshot(reactiveState);
 * // cleanCopy can now be safely serialized or compared
 */
export const snapshot = <T>(state: T) => {
  // Unwraps a proxy object to get its target value
  function unProxy(object: any) {
    if (object && object.constructor === Proxy) {
      return object.target;
    }
    return object as T;
  }

  // Processes each item in an array recursively
  function parseArray(array: any[]) {
    const ouput: any[] = [];
    for (const [index, item] of array.entries()) {
      ouput[index] = step(item);
    }
    return ouput;
  }

  // Processes each property in an object recursively
  function parseObject(object: any) {
    const output: Dic = {};
    for (const [key, value] of Object.entries(object)) {
      output[key] = step(value);
    }
    return output;
  }

  // Recursively processes a value based on its type
  function step(object: any) {
    const isArray = Array.isArray(object);
    const type = Object.prototype.toString.call(object);
    const isObject = type === '[object Object]';
    let output = unProxy(object);

    if (isArray) {
      output = parseArray(object);
    }

    if (isObject) {
      output = parseObject(object);
    }

    return output;
  }

  return step(state) as T;
};
