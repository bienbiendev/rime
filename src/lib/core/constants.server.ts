import path from 'path';

export const PACKAGE_NAME = 'rimecms';
export const IS_RIME_REPO = !import.meta.url.includes('/node_modules/rimecms/');
export const RIME_DEV_CACHE_DIR = path.resolve(process.cwd(), 'node_modules', '.rime');

/** Consumer branding image convention: drop a file at static/panel/panel.jpg. */
export const PANEL_AUTH_IMAGE = '/assets/panel/panel.jpg';
