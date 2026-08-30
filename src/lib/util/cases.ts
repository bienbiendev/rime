/**
 * Picks the first key whose value is `true`, checked in the order written —
 * an if/else-if chain expressed as an object literal, so a run of
 * conditions can be flat instead of nested.
 *
 * Returns `.value` (the winning key, or undefined if none matched) plus
 * every key mapped to itself, so callers can switch/compare on
 * `result.SOME_KEY` instead of a raw string literal.
 *
 * @example
 * const auth = cases({
 *   IS_STAFF: user.role === 'staff',
 *   IS_ADMIN: user.role === 'admin',
 *   IS_USER: true // catch-all, always true, put last
 * });
 *
 * switch (auth.value) {
 *   case auth.IS_ADMIN:
 *     // Type-safe access
 * }
 */
export const cases = <T extends Record<string, boolean>>(
  map: T
): {
  value: ExtractTrueKeys<T> extends never ? keyof T | undefined : keyof T;
} & { [K in keyof T]: K } => {
  // Find the first matching key
  let value;
  for (const [key, condition] of Object.entries(map)) {
    if (condition) {
      value = key as keyof T;
      break;
    }
  }

  // Create the result object with value and all keys
  const result = { value } as any;

  // Add each key as a property
  for (const key of Object.keys(map)) {
    result[key as keyof T] = key as any;
  }

  return result;
};

// Type helper to extract keys with literal true values
type ExtractTrueKeys<T> = {
  [K in keyof T]: T[K] extends true ? K : never;
}[keyof T];

/**
 * Executes the action associated with the given key
 * @example
 * const time = cases({
 *   morning: config.isMorning,
 *   afternoon: config.isAfterNoon,
 *   night: true // default case
 * });
 *
 * const whatToDo = when(time.value, {
 *   morning: takeCoffee(),
 *   afternoon: doRunning(),
 *   night: takeAdring(),
 *   default: 'code'
 * });
 */
export const when = <K extends string | number | symbol, V>(
  key: K | 'default',
  actions: Record<string, V> & { default?: V }
): V => {
  // If the key exists in actions, return that value
  if (key in actions) {
    return actions[key as string];
  }

  // Otherwise return the default value if it exists
  if ('default' in actions) {
    return actions.default as V;
  }

  // If no match and no default, return undefined
  return undefined as unknown as V;
};
