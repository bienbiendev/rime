import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GENERATED_DIR } from '#lib/core/dev/constants.server.js';
import { regenerateDrizzleConfig } from './drizzle-config.server.js';

describe('regenerateDrizzleConfig', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'rime-drizzle-config-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const config = () => join(root, 'drizzle.config.ts');

  it('patches only a stale schema line in drizzle.config.ts, and writes none when it is missing', () => {
    expect(regenerateDrizzleConfig(root)).toBe(false);
    expect(existsSync(config())).toBe(false);

    writeFileSync(
      config(),
      "export default {\n  schema: './old/schema.server.ts',\n  verbose: true\n};\n"
    );
    expect(regenerateDrizzleConfig(root)).toBe(true);
    expect(readFileSync(config(), 'utf8')).toBe(
      `export default {\n  schema: './${GENERATED_DIR}/schema.server.ts',\n  verbose: true\n};\n`
    );
    // Now current: nothing to patch
    expect(regenerateDrizzleConfig(root)).toBe(false);
  });
});
