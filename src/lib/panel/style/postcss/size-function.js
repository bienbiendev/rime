/**
 * `--size(n)`: a length off the size scale, `n` steps of `--rz-unit` (0.25rem).
 *
 * The named sizes (`--rz-size-4`, `--rz-size-2-5`, …) cover the usual steps; this reaches the
 * others without adding two of them together.
 *
 * ```css
 * width: --size(5.5);           ->  width: calc(5.5 * var(--rz-unit));
 * margin: --size(-2) --size(1); ->  margin: calc(-2 * var(--rz-unit)) calc(1 * var(--rz-unit));
 * ```
 *
 * @returns {import('postcss').Plugin}
 */
export const sizeFunction = () => ({
  postcssPlugin: 'rz-size-function',
  Declaration(decl) {
    if (!decl.value.includes('--size(')) return;
    decl.value = decl.value.replace(
      /--size\(\s*(-?\d*\.?\d+)\s*\)/g,
      (/** @type {string} */ _, /** @type {string} */ n) => `calc(${n} * var(--rz-unit))`
    );
  }
});
sizeFunction.postcss = true;
