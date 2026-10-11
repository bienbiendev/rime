import type { User } from '#lib/core/auth/types.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import type { GenericBlock } from '#lib/core/prototype/types.js';
import type { Field } from '#lib/fields/types.js';
import type { Dic } from '#lib/util/types.js';
import { buildConfigMap } from '../config-map/index.js';

/**
 * `doc` without the fields `user` may not read, at any depth.
 *
 * ```ts
 * // text('internalNote').access({ read: isStaff })
 * withoutUnreadableFields({ name: 'Ann', internalNote: 'vip' }, fields, undefined); // { name: 'Ann' }
 * ```
 */
export const withoutUnreadableFields = <T extends Dic>(
  doc: T,
  fields: FieldBuilder<Field>[],
  user: User | undefined
): T => {
  let result: Dic = { ...doc };
  for (const [key, config] of Object.entries(buildConfigMap(doc, fields))) {
    if (!config.use.accessRead(user)) result = withoutAt(result, key.split('.'));
  }
  return result as T;
};

/**
 * Walks every field of the document on the way out: drops what the reader may not see, and hands
 * each value to the field's own `hooks.beforeRead`. An empty value stays empty: a default is what
 * a new document starts with, never what a read shows.
 *
 * A system read is rime's own and keeps every field. One copy of the document, walked in place. A
 * config-map key is already normalized, so it splits straight into its segments.
 */
export const processDocumentFields = Hooks.beforeRead(async function processDocumentFields(args) {
  const { event } = args;
  const doc = args.context.isSystemOperation
    ? { ...args.doc }
    : withoutUnreadableFields(args.doc, args.config.fields, event.locals.user);

  const configMap = buildConfigMap(doc, args.config.fields);

  for (const [key, config] of Object.entries(configMap)) {
    const parts = key.split('.');

    let value = getAt(doc, parts);

    // A field with no hook has nothing to wait for.
    if (value !== undefined && value !== null && config.get.hooks?.beforeRead?.length) {
      value = await config.use.beforeRead(value, {
        event,
        operation: args.context,
        documentId: doc.id
      });
      setAt(doc, parts, value);
    }

    if (config.type === 'blocks') {
      const blocks = getAt(doc, parts) as (GenericBlock | undefined)[] | undefined;
      // Filter out possible undefined block or residual
      // Case undefined : When in dev mode, if a block table is deleted in a migration, a blocks array value could includes undefined ex :
      // * blocks: [ { ... }, undefined, { ... } ]
      // * Because blocks are populated based on path.position
      // Case residual : a block type has been removed but was including a relation, this gives ex :
      // * blocks: [ { id:..., values,... }, { image: {...}} ]
      //                                         ^
      // * the image has been placed but the block doesn't exist anymore
      if (blocks) {
        const withoutResidualBlock = blocks
          .filter((b) => b && 'id' in b) // get only blocks that have .id
          .map((b, index) => ({
            ...b,
            position: index
          }));
        setAt(doc, parts, withoutResidualBlock);
      }
    }
  }

  return { ...args, doc };
});

/** The value the segments lead to, `undefined` past a missing one. */
const getAt = (doc: Dic, parts: string[]): unknown => {
  let current: any = doc;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
};

/** Writes at the segments, opening an object — an array before an index — where one is missing. */
const setAt = (doc: Dic, parts: string[], value: unknown) => {
  let current: any = doc;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index];
    if (!current[part]) current[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
};

/**
 * `doc` without what the segments lead to. Each level on the way is a copy, so `doc` and the
 * objects it holds stay as they are.
 *
 * ```ts
 * withoutAt({ meta: { a: 1, b: 2 } }, ['meta', 'b']); // { meta: { a: 1 } }, a new `meta`
 * ```
 */
const withoutAt = (doc: any, [part, ...rest]: string[]): any => {
  if (doc === null || typeof doc !== 'object' || !(part in doc)) return doc;
  const copy = Array.isArray(doc) ? [...doc] : { ...doc };
  if (rest.length) {
    copy[part] = withoutAt(copy[part], rest);
  } else {
    delete copy[part];
  }
  return copy;
};
