import { getRequestEvent } from '$app/server';
import { RimeError } from '$lib/core/errors';
import { logger } from '$lib/core/logger/index.server.js';
import fs from 'fs';
import path from 'path';

const cachePath = path.resolve(process.cwd(), '.cache');
if (!fs.existsSync(cachePath)) {
	fs.mkdirSync(cachePath);
}

const IS_ENV_CACHE_ENABLED = process.env.RIME_CACHE_ENABLED === 'true';

type CacheStrategy = 'memory' | 'disk';

export class Cache {
	private static memoryCache = new Map<string, any>();
	private static readonly MAX_MEMORY_ENTRIES = 1000;

	private static getCacheStrategy(): CacheStrategy {
		const strategy = process.env.RIME_CACHE_STRATEGY?.toLowerCase();
		return strategy === 'memory' || strategy === 'disk' ? strategy : 'memory';
	}

	static async get<T>(key: string, loadData: () => Promise<T>): Promise<T> {
		const event = getRequestEvent();
		if (!event.locals.cacheEnabled || !IS_ENV_CACHE_ENABLED) {
			logger.debug(`Cache disabled, loading ${key}`);
			return loadData();
		}

		const strategy = this.getCacheStrategy();

		logger.debug(`Cache enabled, loading ${key} with the ${strategy} strategy`);

		if (strategy === 'memory') {
			return this.getFromMemory(key, loadData);
		} else {
			return this.getFromDisk(key, loadData);
		}
	}

	private static async getFromMemory<T>(key: string, loadData: () => Promise<T>): Promise<T> {
		// Check memory cache only
		if (this.memoryCache.has(key)) {
			return this.memoryCache.get(key);
		}

		// Load fresh data and cache in memory only
		const freshData = await loadData();
		this.setMemoryCache(key, freshData);
		return freshData;
	}

	private static async getFromDisk<T>(key: string, loadData: () => Promise<T>): Promise<T> {
		// Check disk cache only
		const keyPath = path.join(cachePath, key + '.txt');
		try {
			const data = await fs.promises.readFile(keyPath, 'utf8');
			return JSON.parse(data);
		} catch (err: any) {
			if (err.code !== 'ENOENT') {
				logger.error(err);
			}
		}

		// Load fresh data and cache to disk only
		const freshData = await loadData();
		await this.setToDisk(key, JSON.stringify(freshData));
		return freshData;
	}

	private static setMemoryCache(key: string, value: any) {
		// Simple LRU: remove oldest entry if at limit
		if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
			const firstKey = this.memoryCache.keys().next().value;
			if (firstKey) {
				this.memoryCache.delete(firstKey);
			}
		}
		this.memoryCache.set(key, value);
	}

	private static async setToDisk(key: string, value: string) {
		const keyPath = path.join(cachePath, key + '.txt');
		await fs.promises.writeFile(keyPath, value);
	}

	static async delete(key: string) {
		const strategy = this.getCacheStrategy();

		if (strategy === 'memory') {
			this.memoryCache.delete(key);
		} else {
			const keyPath = path.join(cachePath, key + '.txt');
			try {
				await fs.promises.rm(keyPath);
			} catch (err: any) {
				if (err.code !== 'ENOENT') {
					logger.error('Failed to delete cache file:', err);
				}
			}
		}
	}

	static clear() {
		this.memoryCache.clear();

		try {
			if (fs.existsSync(cachePath)) {
				fs.rmSync(cachePath, { recursive: true });
				fs.mkdirSync(cachePath);
			}
		} catch (err: any) {
			logger.error('Failed to clear disk cache:', err);
			throw new RimeError(RimeError.OPERATION_ERROR, err.message);
		}
	}
}
