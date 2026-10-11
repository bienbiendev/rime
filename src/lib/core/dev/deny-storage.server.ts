import { trycatchSync } from '../../util/function.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Whether a request URL names `/storage` or anything under it, however it is spelled.
 *
 * ```ts
 * isStorageUrl('/storage/probe.txt');   // true
 * isStorageUrl('/%73torage/db.sqlite'); // true
 * isStorageUrl('/Storage');             // true
 * isStorageUrl('/storages');            // false
 * ```
 */
export const isStorageUrl = (url = '/') => {
  const { pathname } = new URL(url, 'http://localhost');
  // A malformed escape is compared as it is
  const [, decoded] = trycatchSync(() => decodeURIComponent(pathname));
  const path = (decoded ?? pathname).toLowerCase();
  return path === '/storage' || path.startsWith('/storage/');
};

/**
 * A dev server middleware that answers 404 for `/storage` and `/storage/*`. `storage/` holds the
 * uploads and the database, and Vite's own static middleware would otherwise answer 403 for a
 * file it finds there.
 */
export const denyStorage = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
  if (!isStorageUrl(req.url)) return next();
  res.statusCode = 404;
  res.end('Not Found');
};
