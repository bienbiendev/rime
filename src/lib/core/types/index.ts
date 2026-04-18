import type { Dic } from '$lib/util/types.js';

export type OperationQuery = string | ParsedOperationQuery;

export type ParsedOperationQuery = {
  where: Dic;
};
