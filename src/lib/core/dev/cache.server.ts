import { createHash } from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { RIME_DEV_CACHE_DIR } from '../constants.server.js';

/** The string stored under `key`, false when nothing is. */
function get(key: string): string | false {
  const keyPath = path.join(RIME_DEV_CACHE_DIR, key + '.txt');
  const exist = fs.existsSync(keyPath);
  if (exist) {
    return fs.readFileSync(keyPath).toString();
  }
  return false;
}

/** Stores `value` under `key`, creating node_modules/.rime when needed. */
function set(key: string, value: string) {
  if (!fs.existsSync(RIME_DEV_CACHE_DIR)) {
    fs.mkdirSync(RIME_DEV_CACHE_DIR);
  }
  const keyPath = path.join(RIME_DEV_CACHE_DIR, key + '.txt');
  fs.writeFileSync(keyPath, value);
}

const digest = (content: string) => createHash('sha256').update(content).digest('hex');

/**
 * Whether `content` hashes to what is stored under `key`. Stores nothing.
 *
 * `matches` and `remember` are the two verbs for a memo — content that is only ever compared,
 * never read back. Every codegen step asks the same question: is this the string I was given
 * last time? Storing the answer as a digest keeps a 400KB serialized config out of
 * `node_modules/.rime` and makes the comparison a fixed 64 bytes:
 *
 * ```ts
 * if (cache.matches('config', memo)) return;
 * // …the work
 * cache.remember('config', memo);
 * ```
 *
 * A step stores its memo only once its work succeeded: a memo written before would skip the
 * work forever after a failure.
 */
function matches(key: string, content: string): boolean {
  return get(key) === digest(content);
}

/** Records `content` under `key`, as its digest. */
function remember(key: string, content: string) {
  set(key, digest(content));
}

/** Removes what is stored under `key`. */
function del(key: string) {
  const keyPath = path.join(RIME_DEV_CACHE_DIR, key + '.txt');
  if (fs.existsSync(keyPath)) {
    fs.rmSync(keyPath, { force: true });
  }
}

/** Removes every stored entry: the whole node_modules/.rime folder, whether or not it exists. */
function clear() {
  fs.rmSync(RIME_DEV_CACHE_DIR, { recursive: true, force: true });
}

export default {
  get,
  set,
  matches,
  remember,
  clear,
  delete: del
};
