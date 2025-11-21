import dotenv from 'dotenv';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, UserConfig } from 'vite';
import { ensureHasInit } from '../../ensure.server.js';
import { logger } from '../../logger/index.server.js';
import { INPUT_DIR, OUTPUT_DIR } from '../constants.js';
import { sanitize } from '../generate/sanitize/index.js';

dotenv.config({ override: true });
const dev = process.env.NODE_ENV === 'development';

export function rime(): Plugin {
	const VCoreId = '$rime/config';
	const VSchemaId = '$rime/schema';

	const resolvedVModule = (name: string) => '\0' + name;

	return {
		name: 'virtual-rime',

		configureServer(server) {
			// Add a listener for when the server starts
			server.httpServer?.once('listening', () => {
				dev && ensureHasInit();
				// Check if we need to rebuild
				const shouldRebuild = process.argv.includes('--rebuild');
				const rimeDevCacheDir = path.resolve(process.cwd(), '.rime');
				if (shouldRebuild && existsSync(rimeDevCacheDir)) {
					rmSync(rimeDevCacheDir, { recursive: true, force: true });
					logger.info('--rebuild : .rime folder deleted');
				}
			});

			// Add a watcher for sanitizing config changes
			// and trigger schema/routes/types generation
			server.watcher.on('change', async (modulePath) => {
				if (
					modulePath.includes(`src/lib/${INPUT_DIR}`) &&
					!modulePath.includes(`src/lib/${OUTPUT_DIR}`)
				) {
					// Sanitize the config client/server
					try {
						await sanitize();
					} catch (error: any) {
						logger.error('Error while sanitizing config:', error.message);
						throw error;
					}
					// Trigger generation
					try {
						await server.ssrLoadModule(`src/lib/${OUTPUT_DIR}/rime.config.server.ts`);
					} catch (error: any) {
						logger.error('Failed to reload the config', error.message);
						throw error;
					}
				}
			});
		},

		config(): UserConfig {
			return {
				ssr: {
					external: ['sharp']
				},
				optimizeDeps: {
					exclude: ['sharp'],
					include: ['@lucide/svelte']
				},
				build: {
					rollupOptions: {
						external: ['sharp']
					},
					target: 'es2022'
				}
			};
		},

		async handleHotUpdate({ server, file }) {
			function invalidateVModule(moduleId: string) {
				const module = server.moduleGraph.getModuleById(resolvedVModule(moduleId));
				if (module) {
					server.moduleGraph.invalidateModule(module);
					return module;
				}
				return null;
			}

			if (process.env.IS_PACKAGE_DEV && file.includes('src/lib/core/config')) {
				logger.info('reload core config');
				const module = invalidateVModule(VCoreId);
				if (module) return [module];
			}
		},

		resolveId(id) {
			if (id === VCoreId) {
				return resolvedVModule(id);
			}
			if (id === VSchemaId) {
				return resolvedVModule(id);
			}

			return null;
		},

		load(id) {
			const isServer = this.environment?.config?.consumer === 'server';

			if (id === resolvedVModule(VCoreId)) {
				const corePath = isServer ? 'rimecms/config/server' : 'rimecms/config/client';
				return `export * from '${corePath}';`;
			}

			if (id === resolvedVModule(VSchemaId) && isServer) {
				const schemaPath = path.resolve(process.cwd(), `src/lib/${OUTPUT_DIR}/schema.server.ts`);
				if (existsSync(schemaPath)) {
					const modulePath = schemaPath.replace('.ts', '.js');
					return `export * from '${modulePath}'; export { default } from '${modulePath}';`;
				}
			}

			return null;
		}
	};
}
