import { RIME_CACHE_ENABLED, RIME_CACHE_STRATEGY } from '$app/env/private';
import { getRequestEvent } from '$app/server';
import { RimeError } from '#lib/core/errors/index.js';
import { logger } from '#lib/core/logger.server.js';
import fs from 'fs';
import { createHash } from 'node:crypto';
import { deserialize, serialize } from 'node:v8';
import path from 'path';

const cachePath = path.resolve(process.cwd(), '.cache');

/**
 * The file a key is kept in, under `.cache/` in the working directory: its hash, so any key stays
 * a file name there.
 */
const fileOf = (key: string) =>
  path.join(cachePath, `${createHash('sha256').update(key).digest('hex')}.bin`);

type CacheStrategy = 'memory' | 'disk';

export class Cache {
  private static memoryCache = new Map<string, any>();
  private static readonly MAX_MEMORY_ENTRIES = 1000;

  private static getCacheStrategy(): CacheStrategy {
    const strategy = RIME_CACHE_STRATEGY.toLowerCase();
    return strategy === 'memory' || strategy === 'disk' ? strategy : 'memory';
  }

  static async get<T>(key: string, loadData: () => Promise<T>): Promise<T> {
    const event = getRequestEvent();
    if (!event.locals.cacheEnabled || !RIME_CACHE_ENABLED) {
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
    // Each request gets its own copy: a change made by one never reaches the next
    if (this.memoryCache.has(key)) {
      return structuredClone(this.memoryCache.get(key));
    }

    const freshData = await loadData();
    this.setMemoryCache(key, structuredClone(freshData));
    return freshData;
  }

  private static async getFromDisk<T>(key: string, loadData: () => Promise<T>): Promise<T> {
    // Kept with `node:v8`: a hit answers the same shape as the read, dates as dates
    try {
      return deserialize(await fs.promises.readFile(fileOf(key)));
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        logger.error(err);
      }
    }

    const freshData = await loadData();
    await this.setToDisk(key, serialize(freshData));
    return freshData;
  }

  private static setMemoryCache(key: string, value: any) {
    // At the limit, drop the oldest entry (first in, first out).
    if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }
    this.memoryCache.set(key, value);
  }

  private static async setToDisk(key: string, value: Buffer) {
    if (!fs.existsSync(cachePath)) {
      fs.mkdirSync(cachePath);
    }
    await fs.promises.writeFile(fileOf(key), value);
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
