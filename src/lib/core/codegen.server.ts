import devCache from '$lib/core/dev/cache.server.js';
import type { Config } from '$lib/core/config/types.js';
import { regenerateDrizzleConfig, regenerateHooks } from './dev/cli/templates/init.js';
import generatePipelineDoc from './dev/codegen/pipeline/index.server.js';
import generateRoutes from './dev/codegen/routes/index.server.js';
import generateTypes from './dev/codegen/types/index.server.js';
import { RimeError } from './errors/index.js';
import type { BuildConfig } from './config/index.server.js';
import validate from './config/validate.server.js';
import writeMemo from './config/write.server.js';
import { logger } from './logger.server.js';

/**
 * Phase 1 of three — everything rime writes to disk, in the order it writes it.
 *
 * This is to a build what pipeline.server.ts is to a request: the one place the sequence is
 * written down. Unlike the hook pipeline it cannot be a flat array, because each step's output
 * is the next step's input on disk — drizzle.config.ts must be current before generateSchema
 * shells out to drizzle-kit, which reads it straight off the filesystem.
 *
 * Runs *inside* boot, and only under `dev`. That is deliberate, not a leftover: in development
 * codegen is on the fly — editing a collection invalidates the config module, the app reboots,
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
  if (process.env.RIME_CLI !== 'true' && devCache.get('.cli')) {
    logger.debug('Skipping generation, `rime generate` is already running');
    return;
  }

  // 1. Has anything changed since the last run? Everything below is skipped if not.
  const changed = writeMemo(config);

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

  // 4. drizzle.config.ts, before generateSchema: it shells out to drizzle-kit generate/migrate,
  //    which read the schema path straight off disk — stale here means the wrong (or missing)
  //    schema file.
  regenerateDrizzleConfig();

  // 5. The drizzle schema. Owned by the adapter, which is why it arrives as an argument: this
  //    is the one codegen step rime does not implement itself.
  await generateSchema(config);

  // 6. app.generated.d.ts — the types that carry collection and area slugs into consumer code.
  await generateTypes(config);

  // 7. src/hooks.server.ts, if the consumer has not written one.
  regenerateHooks();

  // 8. hooks.generated.md — the resolved hook order.
  generatePipelineDoc(config);
};
