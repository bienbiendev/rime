import { UPLOADS } from '#lib/core/prototype/collection/upload/constant.js';
import { RIME_DEV_CACHE_DIR } from '#lib/core/constants.server.js';
import { logger } from '#lib/core/logger.server.js';
import { trycatch } from '#lib/util/function.js';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR, GENERATED_DIR } from '../../constants.server.js';
import { importAdapterHooks, recordedHooksModule } from '../util/adapter-hooks.server.js';
import { prompt } from '../util/prompt.server.js';

const clearMessage = `Are you sure you want to delete all related rime files (Y/n):
- the files of the database adapter
- ./storage/uploads
- ./src/routes/(rime)
- ./${CONFIG_DIR}
- ./${GENERATED_DIR}
- ./src/app.generated.d.ts
- ./src/rime.generated.d.ts
- ./src/rime.modules.generated.d.ts
- ./src/hooks.server.ts
- ./node_modules/.rime
`;

/**
 * `rime clear`: removes the database adapter's files, then everything rime generated or keeps for
 * itself. Loads no config: the adapter's hooks come from the module `rime init` or the last dev
 * boot recorded in `node_modules/.rime`, else from the default adapter's, as after a fresh install.
 */
export const clear = async (args: { force?: boolean }) => {
  let shouldProceed = true;

  if (!args.force) {
    const response = await prompt(`${clearMessage} (Y/n)`, 'n');
    shouldProceed = response.trim().toLowerCase() === 'y';
  }

  if (!shouldProceed) {
    return logger.debug('Operation cancelled. Great!');
  }

  // The adapter's files, through the hooks module `rime init` or the last dev boot recorded, read
  // before the cache goes, else through the default adapter's
  const [error, removed] = await trycatch(async () =>
    (await importAdapterHooks(recordedHooksModule())).clear()
  );
  if (error) {
    logger.warn(`The database adapter's files are left: ${error.message}`);
  } else {
    removed.forEach((entry) => logger.debug(`- ${entry}`));
  }

  // Remove directories
  rmSync(RIME_DEV_CACHE_DIR, { recursive: true, force: true });
  rmSync(path.join('src', 'routes', '(rime)'), { recursive: true, force: true });
  rmSync(CONFIG_DIR, { recursive: true, force: true });
  rmSync(GENERATED_DIR, { recursive: true, force: true });
  rmSync(UPLOADS.DIRECTORY, { recursive: true, force: true });

  // Remove files
  rmSync(path.join('src', 'hooks.server.ts'), { force: true });
  rmSync(path.join('src', 'app.generated.d.ts'), { force: true });
  rmSync(path.join('src', 'rime.generated.d.ts'), { force: true });
  rmSync(path.join('src', 'rime.modules.generated.d.ts'), { force: true });

  return logger.debug('rime cleared');
};
