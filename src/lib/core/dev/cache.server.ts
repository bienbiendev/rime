import { createHash } from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { RIME_DEV_CACHE_DIR } from '../constants.server.js';

const dev = process.env.NODE_ENV === 'development';

if (!fs.existsSync(RIME_DEV_CACHE_DIR) && dev) {
  fs.mkdirSync(RIME_DEV_CACHE_DIR);
}

function get(key: string): string | false {
  const keyPath = path.join(RIME_DEV_CACHE_DIR, key + '.txt');
  const exist = fs.existsSync(keyPath);
  if (exist) {
    return fs.readFileSync(keyPath).toString();
  }
  return false;
}

function set(key: string, value: string) {
  if (!fs.existsSync(RIME_DEV_CACHE_DIR)) {
    fs.mkdirSync(RIME_DEV_CACHE_DIR);
  }
  const keyPath = path.join(RIME_DEV_CACHE_DIR, key + '.txt');
  fs.writeFileSync(keyPath, value);
}

/**
 * The two verbs for a memo — content that is only ever compared, never read back.
 *
 * Every codegen step asks the same question: is this the string I was given last time? Storing
 * the answer as a digest keeps a 400KB serialized config out of `node_modules/.rime` and makes
 * the comparison a fixed 64 bytes:
 *
 * ```ts
 * if (cache.matches('config', memo)) return false;
 * cache.remember('config', memo);
 * ```
 *
 * Split in two rather than one `changed()` because the schema step stores only once drizzle-kit
 * has actually generated and migrated — a memo written before the work succeeds would skip it
 * forever after a failure.
 */
const digest = (content: string) => createHash('sha256').update(content).digest('hex');

/** Whether `content` hashes to what is stored under `key`. Stores nothing. */
function matches(key: string, content: string): boolean {
  return get(key) === digest(content);
}

/** Records `content` under `key`, as its digest. */
function remember(key: string, content: string) {
  set(key, digest(content));
}

function del(key: string) {
  const keyPath = path.join(RIME_DEV_CACHE_DIR, key + '.txt');
  if (fs.existsSync(keyPath)) {
    fs.rmSync(keyPath, { force: true });
  }
}

function clear() {
  fs.rmSync(RIME_DEV_CACHE_DIR, { recursive: true });
}

export default {
  get,
  set,
  matches,
  remember,
  clear,
  delete: del
};
