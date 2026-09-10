/**
 * A hook's declared name, or `anonymous`.
 *
 * All that is left of `marksOf`. Names are set on the function at runtime by `Hooks.*` rather than
 * carried in its type — a function's own `name` is non-writable, so `declare` uses
 * `defineProperty`, which also makes the hook show up under it in stack traces.
 *
 * The fallback is not defensive padding: a hook can reach a pipeline without having gone through
 * `Hooks.*` at all, and a consumer's bare function is exactly that.
 */
export const hookName = (hook: unknown): string => {
  const named = hook as { name?: unknown };
  return typeof named.name === 'string' && named.name ? named.name : 'anonymous';
};
