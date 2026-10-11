import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { runCodegen } from './codegen.server.js';
import validate from './config/validate.server.js';
import configMemo from './dev/config-memo.server.js';
import { logger } from './logger.server.js';

// The memo store, in memory: the real one writes to node_modules/.rime
const stored = new Map<string, string>();
vi.mock('#lib/core/dev/cache.server.js', () => ({
  default: {
    get: (key: string) => stored.get(key),
    matches: (key: string, content: string) => stored.get(key) === content,
    remember: (key: string, content: string) => stored.set(key, content),
    delete: (key: string) => stored.delete(key)
  }
}));
vi.mock('./dev/cli/templates/init.js', () => ({
  regenerateHooks: vi.fn(),
  regenerateParams: vi.fn()
}));
vi.mock('./dev/codegen/routes/index.server.js', () => ({ default: vi.fn() }));
vi.mock('./dev/codegen/types/index.server.js', () => ({ default: vi.fn(async () => {}) }));
vi.mock('./config/validate.server.js', () => ({ default: vi.fn(() => true) }));

/** Sets RIME_CLI for the current test, and puts the previous value back after it. */
const withRimeCli = (value: string | undefined) => {
  const previous = process.env.RIME_CLI;
  onTestFinished(() => {
    if (previous === undefined) {
      delete process.env.RIME_CLI;
    } else {
      process.env.RIME_CLI = previous;
    }
  });
  if (value === undefined) {
    delete process.env.RIME_CLI;
  } else {
    process.env.RIME_CLI = value;
  }
};

const config = { collections: [], areas: [] } as any;

describe('runCodegen', () => {
  beforeEach(() => stored.clear());

  it('leaves the config memo unstored when a step fails, so the next boot runs it again', async () => {
    const generateSchema = vi.fn(async () => {
      throw new Error('drizzle-kit migrate failed');
    });
    await expect(runCodegen({ config, generateSchema })).rejects.toThrow('migrate failed');
    expect(stored.get('config')).toBeUndefined();

    // The next boot, same config: the steps run again
    await expect(runCodegen({ config, generateSchema })).rejects.toThrow();
    expect(generateSchema).toHaveBeenCalledTimes(2);
  });

  it('stores the config memo once every step succeeded', async () => {
    const generateSchema = vi.fn(async () => {});
    await runCodegen({ config, generateSchema });
    expect(stored.get('config')).toBe(configMemo(config));

    // The next boot, same config: nothing to generate
    await runCodegen({ config, generateSchema });
    expect(generateSchema).toHaveBeenCalledTimes(1);
  });

  it('throws on an invalid config, changed or not, and writes no schema', async () => {
    const generateSchema = vi.fn(async () => {});

    // Changed: nothing is stored yet
    vi.mocked(validate).mockReturnValueOnce(false);
    await expect(runCodegen({ config, generateSchema })).rejects.toThrow('Config not valid');
    expect(generateSchema).not.toHaveBeenCalled();
    expect(stored.get('config')).toBeUndefined();

    // Not changed: a run stored this config, then the same config fails validation
    await runCodegen({ config, generateSchema });
    vi.mocked(validate).mockReturnValueOnce(false);
    await expect(runCodegen({ config, generateSchema })).rejects.toThrow('Config not valid');
    expect(generateSchema).toHaveBeenCalledTimes(1);
  });
});

describe('runCodegen, while `rime generate` runs', () => {
  beforeEach(() => stored.clear());

  it('steps aside for a live process, and not for a dead one or an old date marker', async () => {
    const generateSchema = vi.fn(async () => {});
    withRimeCli(undefined);

    stored.set('.cli', `${process.pid} ${Date.now()}`);
    await runCodegen({ config, generateSchema });
    expect(generateSchema).not.toHaveBeenCalled();

    // A pid no process holds
    stored.set('.cli', `999999999 ${Date.now()}`);
    await runCodegen({ config, generateSchema });
    expect(generateSchema).toHaveBeenCalledTimes(1);

    stored.clear();
    stored.set('.cli', new Date().toISOString());
    await runCodegen({ config, generateSchema });
    expect(generateSchema).toHaveBeenCalledTimes(2);
  });

  it('names the marker file it steps aside for', async () => {
    const generateSchema = vi.fn(async () => {});
    withRimeCli(undefined);
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());

    stored.set('.cli', `${process.pid} ${Date.now()}`);
    await runCodegen({ config, generateSchema });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('node_modules/.rime/.cli.txt'));
  });

  it("steps aside for another user's process, which signal 0 answers with EPERM", async () => {
    const generateSchema = vi.fn(async () => {});
    withRimeCli(undefined);
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' });
    });
    onTestFinished(() => kill.mockRestore());

    stored.set('.cli', `4242 ${Date.now()}`);
    await runCodegen({ config, generateSchema });
    expect(generateSchema).not.toHaveBeenCalled();
  });

  it('does not step aside for a marker older than ten minutes, or one with no start time', async () => {
    const generateSchema = vi.fn(async () => {});
    withRimeCli(undefined);

    // This process is alive, but its id may have been taken after `rime generate` died
    stored.set('.cli', `${process.pid} ${Date.now() - 11 * 60 * 1000}`);
    await runCodegen({ config, generateSchema });
    expect(generateSchema).toHaveBeenCalledTimes(1);

    stored.clear();
    stored.set('.cli', String(process.pid));
    await runCodegen({ config, generateSchema });
    expect(generateSchema).toHaveBeenCalledTimes(2);
  });

  it('runs inside `rime generate` itself, whatever the marker says', async () => {
    const generateSchema = vi.fn(async () => {});
    withRimeCli('true');

    // The marker names a live process: this one
    stored.set('.cli', `${process.pid} ${Date.now()}`);
    await runCodegen({ config, generateSchema });
    expect(generateSchema).toHaveBeenCalledTimes(1);
  });
});
