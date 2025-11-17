import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { definePlugin, type Plugin } from '../index.js';
import { Cache } from './cache.server.js';
import { handler } from './handler.server.js';
import HeaderButton from './HeaderButton.svelte';

export type CacheActions = {
	get: <T>(name: string, get: () => Promise<T>) => Promise<T>;
	clear: () => ReturnType<RequestHandler>;
	isEnabled: (event: RequestEvent) => boolean;
	createKey: (namespace: string, params?: Record<string, unknown>) => string;
};

type CacheOptions = {
	/**
	 * A function that define if the API cache should be enabled.
	 * Only GET requests from non-panel routes are cached
	 *
	 * @example
	 * isEnabled: (event) => !event.locals.user // default
	 */
	isEnabled?: (event: RequestEvent) => boolean;
};

/**
 * Generates a numeric hash from a string using sha256 hashing algorithm.
 * Useful for generating deterministic IDs from string content.
 *
 * @example
 * // Returns a consistent numeric hash string
 * toHash("hello");
 */
export const toHash = (str: string): string => {
	return createHash('sha256').update(str).digest('hex'); // Full 64-char hex string
};

export const cache = definePlugin((options?: CacheOptions) => {
	//
	async function getAction<T>(key: string, get: () => Promise<T>): Promise<T> {
		return await Cache.get<T>(key, get);
	}

	/**
	 * Empty the .cache folder
	 */
	const clearCache = () => {
		Cache.clear();
		return json({ message: 'Cache cleared' });
	};

	const actions: CacheActions = {
		get: getAction,
		clear: clearCache,
		createKey: (namespace: string, params: Record<string, unknown> = {}) => {
			// Start with the namespace
			const values = [namespace];
			// Add all parameter values in a consistent order (sort keys)
			Object.keys(params)
				.sort()
				.forEach((key) => {
					values.push(`${key}:${JSON.stringify(params[key])}`);
				});
			return toHash(values.join('-'));
		},
		isEnabled: options?.isEnabled || ((event) => !event.locals.user)
	};

	return {
		name: 'cache',
		type: 'server',

		configure: (config) => {
			config = {
				...config,
				panel: {
					...(config.panel || {}),
					components: {
						...(config.panel?.components || { header: [], collectionHeader: [] }),
						header: [...(config.panel?.components?.header || []), HeaderButton]
					}
				}
			};
			return config;
		},

		routes: {
			'/api/clear-cache': {
				POST: clearCache
			}
		},

		actions,
		handler
	} as const satisfies Plugin;
});
