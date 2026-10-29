import path from 'path';

export const PACKAGE_NAME = 'rimecms';
/**
 * Whether this code runs from the rime repository rather than from an installed `rimecms`: a
 * path test on this module's URL. Then rime's version is read from the root `package.json`,
 * generated types carry eslint-disable lines, and the Vite plugin reloads on edits to
 * `src/lib/core/config`.
 */
export const IS_RIME_REPO = !import.meta.url.includes('/node_modules/rimecms/');
/** The app's `node_modules/.rime`: the dev cache of codegen memos and the `rime generate` mark. */
export const RIME_DEV_CACHE_DIR = path.resolve(process.cwd(), 'node_modules', '.rime');

/** Consumer branding image convention: drop a file at static/assets/panel/panel.jpg. */
export const PANEL_AUTH_IMAGE = '/assets/panel/panel.jpg';
