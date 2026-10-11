import devCache from '#lib/core/dev/cache.server.js';
import type { Config } from '#lib/core/config/types.js';
import { regenerateHooks, regenerateParams } from './dev/cli/templates/init.js';
import generateRoutes from './dev/codegen/routes/index.server.js';
import generateTypes from './dev/codegen/types/index.server.js';
import { RimeError } from './errors/index.js';
import type { BuildConfig } from './config/index.server.js';
import validate from './config/validate.server.js';
import configMemo from './dev/config-memo.server.js';
import { logger } from './logger.server.js';

/** How long a `rime generate` run may hold the `.cli` marker before it counts as stale. */
const CLI_MARKER_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Whether a `rime generate` process is running. The `.cli` marker holds its process id and the
 * time it started, `'48213 1767225600000'`. A marker with no time, or older than
 * `CLI_MARKER_MAX_AGE_MS`, is stale.
 */
const cliRunning = () => {
  const [pid, startedAt] = String(devCache.get('.cli') || '')
    .split(' ')
    .map(Number);
  if (!pid || !startedAt || Date.now() - startedAt > CLI_MARKER_MAX_AGE_MS) return false;
  try {
    // Signal 0 sends nothing: it throws ESRCH when no process has that id, EPERM when one does
    // but belongs to another user
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/**
 * Phase 1 of three — everything rime writes to disk, in the order it writes it.
 *
 * The one place the build sequence is written down. Unlike the hook pipeline in `core/pipeline/`
 * it cannot be a flat array, because each step's output is the next step's input on disk: the
 * schema is written before the types that declare its module.
 *
 * Runs *inside* boot, and only under `dev`: in development codegen is on the fly — editing a collection invalidates the config module, the app reboots,
 * and this runs again as part of that reload. There is no separate codegen program, and
 * `rime generate` is simply a boot in a throwaway Vite server (dev/cli/commands/generate.server.ts).
 *
 * A consequence of that design: two processes can be in this phase at once — a running dev
 * server and a CLI invocation — both writing the same directories. Hence the guard below.
 */
export const runCodegen = async <const C extends Config>(args: {
  config: BuildConfig<C>;
  generateSchema: (config: BuildConfig<C>) => Promise<void>;
}): Promise<void> => {
  const { config, generateSchema } = args;

  // A `rime generate` CLI run may be regenerating the same .rime cache concurrently (e.g. a
  // running dev server reloading off the CLI's file writes). Skip our own generation this cycle
  // rather than racing it or blocking this request on it — the next natural reload picks up
  // whatever the CLI produced.
  if (process.env.RIME_CLI !== 'true' && cliRunning()) {
    logger.warn(
      'Skipping generation: `rime generate` holds node_modules/.rime/.cli.txt. Delete it if no generate runs.'
    );
    return;
  }

  // 1. Has anything changed since the last run? Everything below is skipped if not.
  const memo = configMemo(config);
  const changed = !devCache.matches('config', memo);

  // 2. Reject a config that cannot produce a coherent schema, before writing any of it.
  if (!validate(config)) {
    throw new RimeError('Config not valid');
  }

  if (!changed) {
    logger.debug('Nothing to generate');
    return;
  }

  // 3. SvelteKit routes — the (rime) panel tree and /api, plus the param matchers.
  generateRoutes(config);

  // 4. The drizzle schema. Owned by the adapter, which is why it arrives as an argument: this
  //    is the one codegen step rime does not implement itself. The adapter keeps its own
  //    drizzle.config.ts current.
  await generateSchema(config);

  // 5. app.generated.d.ts — the types that carry collection and area slugs into consumer code.
  await generateTypes(config);

  // 6. src/hooks.server.ts, if the consumer has not written one.
  regenerateHooks();

  // 7. src/params.ts, if the consumer has not written one — the file that spreads the matchers
  //    generateRoutes wrote.
  regenerateParams();

  // 8. Every step wrote its files: the next boot with this config has nothing to do. A step that
  //    threw leaves the memo unstored, so the next boot runs them again.
  devCache.remember('config', memo);
};
