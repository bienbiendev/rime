import { RIME_DEV_CACHE_DIR } from '$lib/core/constant.server.js';
import fs from 'fs';
import path from 'path';

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
  clear,
  delete: del
};
