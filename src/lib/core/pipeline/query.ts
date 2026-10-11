import type { BuiltCollection } from '#lib/core/config/types.js';
import { RimeError } from '#lib/core/errors/index.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import { getFieldAtPath, isFormField } from '#lib/core/fields/util.js';
import { walkFields } from '#lib/core/fields/walk.js';
import { isRelationField } from '#lib/fields/relation/index.js';
import type { Field } from '#lib/fields/types.js';
import { isObjectLiteral } from '#lib/util/object.js';
import type { Dic } from '#lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import qs from 'qs';
import type { OperationQuery, ParsedOperationQuery } from './types.js';

/**
 * How deep a `where` may nest and how long a list may be: `where[and][0][or][0][field][op]` is
 * six brackets, and an `in_array` list names one entry per id.
 */
const PARSE_LIMITS = { depth: 12, arrayLimit: 1000 };

/**
 * Parses and validates an incoming query into `{ where }`.
 *
 * The REST list and delete handlers, and the adapter's reads and writes, call it before a query
 * reaches SQL.
 *
 * @example
 * normalizeQuery('where[title][equals]=Home') // { where: { title: { equals: 'Home' } } }
 */
export function normalizeQuery(incomingQuery: OperationQuery): ParsedOperationQuery {
  let query;
  if (typeof incomingQuery === 'string') {
    try {
      query = qs.parse(incomingQuery, PARSE_LIMITS);
    } catch (err: any) {
      throw new RimeError(
        RimeError.INVALID_DATA,
        'Unable to parse given string query ' + err.message
      );
    }
  } else {
    if (!isObjectLiteral(incomingQuery)) {
      throw new RimeError(RimeError.INVALID_DATA, 'Query is not an object');
    }
    query = incomingQuery;
  }
  if (!isObjectLiteral(query.where)) {
    throw new RimeError(RimeError.INVALID_DATA, 'Query must have a root where object');
  }
  return query as ParsedOperationQuery;
}

/** What a `where` or a `sort` may name besides a field: a document's ids, a page's address. */
const DOCUMENT_KEYS = ['id', 'versionId', 'ownerId', 'url', '_urlPath'];

/**
 * The field paths a `where` filters on, through `and` and `or`.
 *
 * ```ts
 * queryPaths({ and: [{ title: { equals: 'a' } }, { or: [{ 'attributes.slug': { like: 'b%' } }] }] })
 * // ['title', 'attributes.slug']
 * ```
 */
export const queryPaths = (where: Dic): string[] =>
  Object.entries(where).flatMap(([key, value]) =>
    key === 'and' || key === 'or' ? Object.values(value as Dic).flatMap(queryPaths) : [key]
  );

/** The longest start of `path` that names a field, and what follows it. */
const fieldAtStart = (path: string, fields: FieldBuilder<Field>[]) => {
  const parts = path.split('.');
  for (let length = parts.length; length > 0; length--) {
    const field = getFieldAtPath(parts.slice(0, length).join('.'), fields);
    if (field) return { field, rest: parts.slice(length).join('.') };
  }
  return undefined;
};

/**
 * Throws when the reader may not filter or sort `config` on `path`: `UNAUTHORIZED` for a field
 * they may not read or a related collection they may not read, `BAD_REQUEST` for a column that
 * is no field. A path past a relation is checked again in the related collection.
 *
 * ```ts
 * // pages: relation('author').to('staff'), read anonymously
 * assertReadablePath({ config: pages, event, path: 'author.email' }); // throws: staff is not readable
 * assertReadablePath({ config: users, event, path: 'authUserId' }); // throws: not a field
 * ```
 */
const assertReadablePath = (args: {
  config: BuiltCollection;
  event: RequestEvent;
  path: string;
}) => {
  const { config, event, path } = args;
  const { user } = event.locals;

  const hidden = [...walkFields(config.fields, { determinate: true })]
    .filter(({ field }) => isFormField(field) && !field.use.accessRead(user))
    .map((walked) => walked.path);
  if (hidden.some((field) => path === field || path.startsWith(`${field}.`))) {
    throw new RimeError(RimeError.UNAUTHORIZED, `${path} cannot be filtered or sorted on`);
  }
  if (DOCUMENT_KEYS.includes(path)) return;

  const found = fieldAtStart(path, config.fields);
  if (found && !found.rest) return;
  if (!found || !isRelationField(found.field)) {
    throw new RimeError(RimeError.BAD_REQUEST, `${path} is not a field of ${config.slug}`);
  }

  // `author.email`: the related collection must be readable, then `email` in it.
  const target = event.locals.rime.config.getCollection(found.field.get.relationTo);
  if (!target.access.read(user, { event })) {
    throw new RimeError(RimeError.UNAUTHORIZED, `${path} cannot be filtered or sorted on`);
  }
  assertReadablePath({ config: target, event, path: found.rest });
};

/**
 * Throws when the query or the sort names what the reader may not read: filtering or ordering on
 * a hidden value tells the reader what it holds.
 *
 * ```ts
 * // text('draftNote').access({ read: isStaff }), read anonymously
 * assertReadableQuery({ config: notices, event, query: { where: { draftNote: { like: 'a%' } } } });
 * // throws: draftNote cannot be filtered or sorted on
 * ```
 */
export const assertReadableQuery = (args: {
  config: BuiltCollection;
  event: RequestEvent;
  query?: OperationQuery;
  sort?: string;
}) => {
  const { config, event, query, sort } = args;
  const named = [
    ...(query ? queryPaths(normalizeQuery(query).where) : []),
    ...(sort ? [sort.replace(/^-/, '')] : [])
  ];
  for (const path of named) {
    assertReadablePath({ config, event, path });
  }
};
