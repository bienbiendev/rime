import { describe, expect, it, vi } from 'vitest';
import { bootRime } from './boot.server.js';

/** Every step the dev boot takes, in order. */
const steps: string[] = [];

vi.mock('$app/env', () => ({ dev: true }));
vi.mock('$app/env/private', () => ({
  RIME_LOG_LEVEL: 'error',
  RIME_LOG_TO_FILE: false,
  RIME_LOG_TO_FILE_MAX_DAYS: 30
}));
vi.mock('./dev/cache.server.js', () => ({
  default: { set: (key: string, value: string) => steps.push(`record ${key}=${value}`) }
}));
vi.mock('./codegen.server.js', () => ({
  runCodegen: async () => {
    steps.push('codegen');
  }
}));
vi.mock('./prototype/collection/upload/boot/index.server.js', () => ({ bootUpload: () => {} }));

describe('the dev boot', () => {
  it("records the adapter's hooks module, then runs its boot, then codegen", async () => {
    const config = {
      collections: [],
      areas: [],
      plugins: [],
      $adapter: {
        hooks: {
          module: '@acme/rime-postgres/hooks',
          boot: async () => {
            steps.push('adapter boot');
          }
        },
        generateSchema: async () => {},
        // The steps after codegen are not under test: stop there
        createAdapter: async () => {
          throw new Error('stop');
        }
      }
    };

    await expect(bootRime(config as never)).rejects.toThrow('stop');

    expect(steps).toEqual([
      'record adapter-hooks=@acme/rime-postgres/hooks',
      'adapter boot',
      'codegen'
    ]);
  });
});
