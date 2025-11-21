import { logger } from '$lib/core/logger/index.server.js';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { INPUT_DIR, OUTPUT_DIR } from '../../constants.js';
import { prompt } from '../util.server.js';

const clearMessage = `Are you sure you want to delete all related rime files (Y/n):
- ./static/medias
- ./db
- ./src/routes/(rime)
- ./src/lib/${INPUT_DIR}
- ./src/lib/${OUTPUT_DIR}
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
	rmSync(path.join('.rime'), { recursive: true, force: true });
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

	return logger.info('rime cleared');
};
