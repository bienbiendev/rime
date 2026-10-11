const SCRIPT_SCHEMES = /^(javascript|vbscript|data):/i;

/**
 * Whether a URL is safe to put in `href`: it does not use a scheme that runs script.
 * Spaces and control characters are removed before the test, as the browser removes them.
 *
 * ```ts
 * isSafeUrl('/about') // true
 * isSafeUrl('https://rime.dev') // true
 * isSafeUrl(' javascript:alert(1)') // false
 * isSafeUrl('java\tscript:alert(1)') // false
 * ```
 */
export const isSafeUrl = (url: string): boolean =>
  !SCRIPT_SCHEMES.test([...url].filter((char) => char > ' ').join(''));
