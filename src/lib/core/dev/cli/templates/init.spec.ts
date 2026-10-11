import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  GENERATED_DIR,
  configImportPaths,
  paramsPath,
  relativeImportSpecifier
} from '../../constants.server.js';
import {
  addEnvVars,
  appParams,
  envVars,
  hooks,
  missingEnvVars,
  regenerateDrizzleConfig,
  regenerateHooks,
  regenerateParams,
  setSvelteKitAdapter
} from './init.js';

describe('src/env.ts declarations', () => {
  it('finds nothing missing in the template', () => {
    expect(missingEnvVars(envVars())).toEqual([]);
  });

  it('adds the missing ones at the top, keeping the app’s own', () => {
    const content = `export const variables = defineEnvVars({\n  API_KEY: {},\n  SITE_URL: { public: true }\n});\n`;
    const missing = missingEnvVars(content);
    expect(missing).not.toContain('SITE_URL');
    expect(missing).toContain('BETTER_AUTH_SECRET');

    const next = addEnvVars(content, missing)!;
    expect(missingEnvVars(next)).toEqual([]);
    expect(next).toContain('  API_KEY: {},\n  SITE_URL: { public: true }\n});');
    expect(next).toMatch(/defineEnvVars\(\{\n {2}BETTER_AUTH_SECRET: \{\},\n/);
  });

  it('answers null without a defineEnvVars call', () => {
    expect(addEnvVars('export const variables = {};', ['SITE_URL'])).toBeNull();
  });
});

describe("the patchers of a project's own files", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'rime-init-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Writes `content` at `file`, a path below the temporary project root. */
  const write = (file: string, content: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  };

  /** The content of `file`, a path below the temporary project root. */
  const read = (file: string) => readFileSync(join(root, file), 'utf8');

  // hooks.server.ts imports the config relative to this repository's src/
  const hooksImportLine = `import config from '${configImportPaths(resolve(process.cwd(), 'src')).server}';`;

  it('writes hooks.server.ts when the project has none', () => {
    expect(regenerateHooks(root)).toBe(true);
    expect(read('src/hooks.server.ts')).toBe(hooks());
  });

  it('patches only a stale config import in hooks.server.ts, and adds handleError', () => {
    write('src/hooks.server.ts', "import config from './old.js';\n// mine\n");
    expect(regenerateHooks(root)).toBe(true);
    expect(read('src/hooks.server.ts')).toBe(
      `${hooksImportLine}\n// mine\nexport { handleError } from 'rimecms/server';\n`
    );
  });

  it("leaves a current hooks.server.ts with the app's own handleError alone", () => {
    const own = `${hooksImportLine}\nexport const handleError = () => {};\n`;
    write('src/hooks.server.ts', own);
    expect(regenerateHooks(root)).toBe(false);
    expect(read('src/hooks.server.ts')).toBe(own);
  });

  it('writes src/params.ts when the project has no params file', () => {
    mkdirSync(join(root, 'src'));
    expect(regenerateParams(root)).toBe(true);
    expect(read('src/params.ts')).toBe(appParams(join(root, 'src')));
  });

  it("patches only a stale import of rime's matchers in the params file", () => {
    write(
      'src/params.ts',
      "import { params as rime } from './old/params.ts';\nexport const params = defineParams({ ...rime, mine });\n"
    );
    expect(regenerateParams(root)).toBe(true);
    const importLine = `import { params as rime } from '${relativeImportSpecifier(join(root, 'src'), paramsPath())}';`;
    expect(read('src/params.ts')).toBe(
      `${importLine}\nexport const params = defineParams({ ...rime, mine });\n`
    );
  });

  it("leaves a params file without rime's matchers as it is", () => {
    const own = 'export const params = {};\n';
    write('src/params.ts', own);
    expect(regenerateParams(root)).toBe(false);
    expect(read('src/params.ts')).toBe(own);
  });

  it('patches only a stale schema line in drizzle.config.ts, and writes none when it is missing', () => {
    expect(regenerateDrizzleConfig(root)).toBe(false);
    expect(existsSync(join(root, 'drizzle.config.ts'))).toBe(false);

    write(
      'drizzle.config.ts',
      "export default {\n  schema: './old/schema.server.ts',\n  verbose: true\n};\n"
    );
    expect(regenerateDrizzleConfig(root)).toBe(true);
    expect(read('drizzle.config.ts')).toBe(
      `export default {\n  schema: './${GENERATED_DIR}/schema.server.ts',\n  verbose: true\n};\n`
    );
    // Now current: nothing to patch
    expect(regenerateDrizzleConfig(root)).toBe(false);
  });

  it('swaps adapter-auto for adapter-node, and leaves any other adapter', () => {
    write('vite.config.ts', "import adapter from '@sveltejs/adapter-auto';\n");
    write('vite.config.js', 'import adapter from "@sveltejs/adapter-vercel";\n');
    expect(setSvelteKitAdapter(root)).toEqual(['vite.config.ts']);
    expect(read('vite.config.ts')).toBe("import adapter from '@sveltejs/adapter-node';\n");
    expect(read('vite.config.js')).toBe('import adapter from "@sveltejs/adapter-vercel";\n');
  });
});
