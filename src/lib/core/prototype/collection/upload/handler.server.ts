import { isStaff } from '#lib/core/auth/access.js';
import type { BuiltCollection } from '#lib/core/config/types.js';
import { RimeError } from '#lib/core/errors/index.js';
import { UPLOADS } from '#lib/core/prototype/collection/upload/constant.js';
import { rowFiles } from '#lib/core/prototype/collection/upload/disk/delete.server.js';
import {
  isPrivateUpload,
  mediaFilePath,
  mediasFolder
} from '#lib/core/prototype/collection/upload/disk/medias.server.js';
import {
  isUploadConfig,
  type WithUpload
} from '#lib/core/prototype/collection/upload/util/config.js';
import { getMimeTypeFromExtension } from '#lib/core/prototype/collection/upload/util/mime.js';
import type { CollectionSlug } from '#lib/core/prototype/types.js';
import { trycatch, trycatchSync } from '#lib/util/function.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

/** `/uploads/<folder>/<file>` */
const UPLOAD_URL = new RegExp(`^${UPLOADS.URL}/([^/]+)/([^/]+)$`);

const notFound = () => new Response('Not Found', { status: 404 });

/**
 * The bytes a `Range` header asks for, of a file of `size` bytes. `null` for no range, or for one
 * this does not serve (several ranges, another unit, an end before its start): the whole file.
 *
 * ```ts
 * byteRange('bytes=0-99', 1000);  // { start: 0, end: 99 }
 * byteRange('bytes=900-', 1000);  // { start: 900, end: 999 }
 * byteRange('bytes=-100', 1000);  // { start: 900, end: 999 }
 * byteRange('bytes=1000-', 1000); // 'unsatisfiable'
 * ```
 */
export const byteRange = (header: string | null, size: number) => {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!match || (!match[1] && !match[2])) return null;

  const [, from, to] = match;
  if (from && to && Number(to) < Number(from)) return null;

  // `-100` is the last 100 bytes
  const start = from ? Number(from) : Math.max(size - Number(to), 0);
  const end = from && to ? Math.min(Number(to), size - 1) : size - 1;
  if (start >= size) return 'unsatisfiable';
  return { start, end };
};

/** Whether an `If-None-Match` header names `etag`, weak or strong, or is `*`. */
const matchesETag = (header: string | null, etag: string) =>
  !!header &&
  header
    .split(',')
    .map((tag) => tag.trim().replace(/^W\//, ''))
    .some((tag) => tag === '*' || tag === etag);

/**
 * A file on disk as a response: 304 when the caller holds it already, the bytes a `Range` names
 * (206, or 416 outside the file), the whole file otherwise. Streamed, and with no body to a
 * `HEAD`. 404 when there is no file.
 */
export const fileResponse = async (request: Request, filePath: string, cacheControl: string) => {
  const [error, stats] = await trycatch(() => stat(filePath));
  if (error || !stats.isFile()) return notFound();

  const etag = `"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
  const headers = new Headers({
    etag,
    'last-modified': stats.mtime.toUTCString(),
    'cache-control': cacheControl,
    'accept-ranges': 'bytes'
  });

  if (matchesETag(request.headers.get('if-none-match'), etag)) {
    return new Response(null, { status: 304, headers });
  }

  const range = byteRange(request.headers.get('range'), stats.size);
  if (range === 'unsatisfiable') {
    headers.set('content-range', `bytes */${stats.size}`);
    return new Response(null, { status: 416, headers });
  }

  const { start, end } = range ?? { start: 0, end: stats.size - 1 };
  const type = getMimeTypeFromExtension(path.extname(filePath).slice(1));
  headers.set('content-type', type ?? 'application/octet-stream');
  headers.set('content-length', String(end - start + 1));
  if (range) {
    headers.set('content-range', `bytes ${start}-${end}/${stats.size}`);
  }

  // An empty file has no byte to stream
  const hasBody = request.method !== 'HEAD' && stats.size > 0;
  const body = hasBody
    ? (Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream)
    : null;
  return new Response(body, { status: range ? 206 : 200, headers });
};

/**
 * Whether the caller may read a document of `config` that names `name`, as its file or as one of
 * its sizes. Read as the caller, so the collection's access and its field access apply. Staff
 * reads every version of a versioned document, anyone else its published one.
 */
const isReadable = async (
  event: RequestEvent,
  config: WithUpload<BuiltCollection>,
  name: string
) => {
  const { rime, user } = event.locals;
  const slug = config._versions && isStaff(user) ? config._versions.slug : config.slug;

  // A size column holds its file, or each format's joined by `|`
  const sizes = config.upload.imageSizes ?? [];
  const where = {
    or: [{ filename: { equals: name } }, ...sizes.map((size) => ({ [size.name]: { like: name } }))]
  };
  // The refusal can come before the read starts, so a throw is caught as well as a rejection
  const [error, docs] = await trycatch(() =>
    rime.collection(slug as CollectionSlug).find({ query: { where } })
  );
  if (error) {
    // A caller who may not read the collection gets the 404 a missing file gets
    if (error instanceof RimeError && error.code === RimeError.UNAUTHORIZED) {
      return false;
    }
    throw error;
  }
  return docs.some((doc) => rowFiles(doc)?.files.includes(name));
};

/**
 * Serves the uploaded files, `GET` and `HEAD` on `/uploads/<folder>/<file>`.
 *
 * ```
 * a public collection's file    to anyone, cache-control: public, max-age=86400
 * a private collection's file   to a caller who may read a document naming it, as its file or
 *                               as one of its sizes; cache-control: private, no-cache
 * anything else in a folder     404, so a refused file and a missing one look alike
 * a folder no collection has    the rest of the handle chain: a site may have its own /uploads
 * ```
 */
export const handleUploads: Handle = async ({ event, resolve }) => {
  const { method } = event.request;
  const match = UPLOAD_URL.exec(event.url.pathname);
  if (!match || (method !== 'GET' && method !== 'HEAD')) return resolve(event);

  const [, folder, encoded] = match;
  const config = event.locals.rime.config.raw.collections
    .filter(isUploadConfig)
    .find((collection) => !collection._shadowOf && mediasFolder(collection) === folder);
  if (!config) return resolve(event);

  // A name that is not a file of the folder is no file
  const [error, file] = trycatchSync(() => {
    const name = decodeURIComponent(encoded);
    return { name, path: mediaFilePath(config, name) };
  });
  if (error) return notFound();

  const isPrivate = isPrivateUpload(config);
  if (isPrivate && !(await isReadable(event, config, file.name))) return notFound();

  const cacheControl = isPrivate ? 'private, no-cache' : 'public, max-age=86400';
  return fileResponse(event.request, file.path, cacheControl);
};
