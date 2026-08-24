import { RIME_DEV_CACHE_DIR } from '$lib/core/constant.server.js';
import { logger } from '$lib/core/logger/index.server.js';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { INPUT_DIR, OUTPUT_DIR } from '../../constants.js';
import { prompt } from '../util/prompt.server.js';

const clearMessage = `Are you sure you want to delete all related rime files (Y/n):
- ./static/medias
- ./db
- ./src/routes/(rime)
- ./src/lib/${INPUT_DIR}
- ./src/lib/${OUTPUT_DIR}
- ./src/lib/rime.config.ts
- ./src/lib/rime.config.server.ts
- ./src/lib/rime.schema.server.ts
- ./src/app.generated.d.ts
- ./src/rime.generated.d.ts
- ./src/hooks.server.ts
- ./drizzle.config.ts
`;

export const clear = async (args: { force?: boolean }) => {
  let shouldProceed = true;

  if (!args.force) {
    const response = await prompt(`${clearMessage} (Y/n)`, 'n');
    shouldProceed = response.trim().toLowerCase() === 'y';
  }

  if (!shouldProceed) {
    return logger.info('Operation cancelled. Great!');
  }

  // Remove directories
  rmSync(RIME_DEV_CACHE_DIR, { recursive: true, force: true });
  rmSync(path.join('src', 'routes', '(rime)'), { recursive: true, force: true });
  rmSync(path.join('src', 'lib', INPUT_DIR), { recursive: true, force: true });
  rmSync(path.join('src', 'lib', OUTPUT_DIR), { recursive: true, force: true });
  rmSync(path.join('db'), { recursive: true, force: true });
  rmSync(path.join('static', 'medias'), { recursive: true, force: true });

  // Remove files
  rmSync(path.join('src', 'hooks.server.ts'), { force: true });
  rmSync(path.join('src', 'app.generated.d.ts'), { force: true });
  rmSync(path.join('src', 'rime.generated.d.ts'), { force: true });
  rmSync(path.join('drizzle.config.ts'), { force: true });
  // Standalone config (see core/dev/generate/sanitize/index.server.js) — the folder-mode
  // dir above already covers +rime/, this covers the two root files standalone mode uses
  // instead. Doesn't touch whatever sibling folders (e.g. documents/) a standalone config's
  // own collections live in — those aren't a fixed, known location the way +rime/ is.
  rmSync(path.join('src', 'lib', 'rime.config.ts'), { force: true });
  rmSync(path.join('src', 'lib', 'rime.config.server.ts'), { force: true });
  // Schema — unconditional location in both modes now, not inside +rime.generated/ (see
  // adapter-sqlite/generate-schema/write.server.ts).
  rmSync(path.join('src', 'lib', 'rime.schema.server.ts'), { force: true });
  // only for the rime repo
  rmSync(path.join('src', 'lib', '+config'), { recursive: true, force: true });

  return logger.info('rime cleared');
};
