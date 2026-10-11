import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

// A temporary project root, made the working directory before any module of rime loads: the
// generator writes under process.cwd(), which it reads when its module loads.
const root = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rime-generate-routes-'));
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
  return dir;
});

// No memo is ever stored, so every call writes the tree
vi.mock('#lib/core/dev/cache.server.js', () => ({
  default: { matches: () => false, remember: () => {} }
}));

import { GENERATED_DIR } from '../../constants.server.js';
import { collection } from '#lib/core/prototype/collection/definition.server.js';
import generateRoutes from './index.server.js';

afterAll(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

/** A config with one collection and no area. */
const config = {
  collections: [{ type: 'collection', slug: 'pages', kebab: 'pages' }],
  areas: []
} as any;

describe('generateRoutes', () => {
  it('writes no area route and no area matcher for an area-less config', () => {
    // The tree is written in the temporary root, never in this repository
    expect(process.cwd()).toBe(root);
    mkdirSync(join(root, GENERATED_DIR), { recursive: true });

    generateRoutes(config);

    const files = readdirSync(join(root, 'src/routes'), { recursive: true }) as string[];
    expect(files).toContain(join('(rime)', '[panel=panel]', '[slug=collection]', '+page.svelte'));
    expect(files.filter((file) => file.includes('[slug=area]'))).toEqual([]);

    const params = readFileSync(join(root, GENERATED_DIR, 'params.ts'), 'utf8');
    expect(params).toContain('collection: oneOf(["pages"])');
    expect(params).not.toContain('area:');
  });

  it('writes one +server.ts per declared REST path, exporting its methods only', () => {
    expect(process.cwd()).toBe(root);
    mkdirSync(join(root, GENERATED_DIR), { recursive: true });

    generateRoutes(config);

    const api = join(root, 'src/routes/(rime)/api/[slug=collection]');
    for (const [routePath, routeConfig] of Object.entries(collection.rest ?? {})) {
      const server = readFileSync(join(api, routePath, '+server.ts'), 'utf8');
      const exported = [...server.matchAll(/^export const (\w+) = handle;$/gm)].map(
        (match) => match[1]
      );
      expect(exported).toEqual(Object.keys(routeConfig));
      expect(server).toContain(`rest('collection', '${routePath}', event)`);
    }
  });
});
