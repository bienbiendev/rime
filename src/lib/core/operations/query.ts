import { RimeError } from '$lib/core/errors/index.js';
import { isObjectLiteral } from '$lib/util/object.js';
import qs from 'qs';
import type { OperationQuery, ParsedOperationQuery } from './types.js';

/**
 * Parses and validates an incoming query into `{ where }`.
 *
 * Lived in the sqlite adapter, and was core's only runtime import from it — REST's list and
 * delete handlers called it to normalize a query string before passing it to an operation.
 * Nothing about it is SQL: it is qs parsing and a shape check over `OperationQuery`, which is
 * declared next door. An adapter is free to call it, but it is not the adapter's to own.
 *
 * @example
 * // returns
 * { where: queryObject }
 */
export function normalizeQuery(incomingQuery: OperationQuery): ParsedOperationQuery {
  let query;
  if (typeof incomingQuery === 'string') {
    try {
      query = qs.parse(incomingQuery);
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
  if (!query.where) {
    throw new RimeError(RimeError.INVALID_DATA, 'Query must have a root where property');
  }
  return query as ParsedOperationQuery;
}
