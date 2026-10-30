import { PANEL_AUTH_IMAGE } from '#lib/core/constants.server.js';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Where an app's static files are served from: `static/`, then adapter-node's `build/client`. */
const STATIC_DIRS = ['static', path.join('build', 'client')];

/** `undefined` until the first look. */
let image: string | null | undefined;

/**
 * The auth pages' background, `PANEL_AUTH_IMAGE`, when the app serves it, else `null`: a page
 * never asks for a missing image. Looked up once per server, in the folders its static files are
 * served from, so a file added later shows after a restart.
 */
export const panelAuthImage = (): string | null => {
  if (image === undefined) {
    const served = STATIC_DIRS.some((dir) =>
      existsSync(path.join(process.cwd(), dir, PANEL_AUTH_IMAGE))
    );
    image = served ? PANEL_AUTH_IMAGE : null;
  }
  return image;
};
