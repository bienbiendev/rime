import { isObjectLiteral } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import type { FieldBuilder } from './builders/field-builder.js';

/** A field the walk reached, the path it sits at, and the data there when the walk has data. */
export type Visit = { field: FieldBuilder; path: string; value: unknown };

/** The document grammar's join. A joiner is never handed an empty part — a branch that
 *  contributes no segment keeps its parent's path — so it only guards the empty parent. */
export const joinPath = (parent: string, part: string) => (parent ? `${parent}.${part}` : part);

export type WalkOptions = {
  path?: string;
  /** The schema generator joins with `__`. */
  join?: (parent: string, part: string) => string;
  /** Skip branches whose segment holds a `#` — a path no config alone can name. */
  determinate?: boolean;
};

/**
 * Every field the config declares, parents before children, siblings in declaration order.
 *
 * ```
 * tabs(tab('meta').fields(group('seo').fields(text('title'))))
 *   ->  meta.seo  ·  meta.seo.title
 * ```
 */
export function* walkFields(
  fields: FieldBuilder[],
  { path = '', join = joinPath, determinate = false }: WalkOptions = {}
): Generator<Visit> {
  for (const field of fields) {
    const own = field.name ? join(path, field.name) : path;
    yield { field, path: own, value: undefined };
    for (const node of field.use.nodes()) {
      if (determinate && node.segment.includes('#')) continue;
      const below = node.segment ? join(own, node.segment) : own;
      yield* walkFields(node.fields, { path: below, join, determinate });
    }
  }
}

/**
 * Every field a document actually carries, at the path its value sits at. A named field the data
 * does not hold contributes nothing.
 *
 * ```
 * blocks('layout', [block('hero').fields(text('title'))])
 *   { layout: [ { type: 'hero', title: 'x' } ] }  ->  layout  ·  layout.0:hero.title
 * ```
 */
export function* walkValues(
  fields: FieldBuilder[],
  data: unknown,
  { path = '', join = joinPath }: WalkOptions = {}
): Generator<Visit> {
  for (const field of fields) {
    if (field.name && !(isObjectLiteral(data) && field.name in data)) continue;
    const own = field.name ? join(path, field.name) : path;
    const value = field.name ? (data as Dic)[field.name] : data;
    yield { field, path: own, value };
    for (const node of field.use.nodesFor(value)) {
      const below = node.segment ? join(own, node.segment) : own;
      yield* walkValues(node.fields, node.value, { path: below, join });
    }
  }
}

const escapeRegex = (str: string) => str.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');

/**
 * Whether one concrete segment is the branch a declared segment stands for.
 *
 * ```
 * '#:hero' matches '0:hero'  ·  '#' matches '7'  ·  'meta' matches only 'meta'
 * ```
 */
export const matchesSegment = (pattern: string, segment: string) =>
  new RegExp(`^${pattern.split('#').map(escapeRegex).join('\\d+')}$`).test(segment);
