import { IS_RIME_REPO, PACKAGE_NAME } from '../constants.server.js';
import { findInstalledPackageRoot } from './codegen/runtime/index.server.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The rime version currently installed, as its own `package.json` states it.
 *
 * Read off disk rather than baked in, so it is the version actually present in the consuming
 * project — which is the point: this is a cache key, and it has to change when the package does.
 *
 * In this repo rime is the project, so the manifest is the one at the root; in a consumer it is
 * the installed package's, found the way `$rime/modules` finds it. An unreadable manifest returns
 * a value nobody matches, which regenerates every time rather than never — the safe direction for
 * a cache key to fail in.
 */
export const rimeVersion = (): string => {
  try {
    const root = IS_RIME_REPO
      ? process.cwd()
      : findInstalledPackageRoot(PACKAGE_NAME, process.cwd());

    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
    return manifest.version ?? 'unknown';
  } catch {
    return `unresolved:${Date.now()}`;
  }
};
