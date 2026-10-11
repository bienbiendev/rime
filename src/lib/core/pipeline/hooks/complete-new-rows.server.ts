import { initialValues } from '#lib/core/fields/initial.js';
import { walkValues } from '#lib/core/fields/walk.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { isObjectLiteral, setValueAtPath, withDefaultValues } from '#lib/util/object.js';
import type { Dic } from '#lib/util/types.js';
import { isSaved } from '../persist/repeatable.server.js';

/**
 * Gives each new row (a block or a tree item with no saved id) the fields it did not send: each
 * field's default, `null` without one. A new row starts whole, as the panel starts it and as
 * `mergeWithInitialDocument` starts a new document, so `validateFields` checks its required
 * fields. A stored row sent in part is left as sent: the fields it leaves out keep their stored
 * values.
 *
 * ```ts
 * // block('call_to_action').fields(text('title').required(), text('label').defaultValue('Go'))
 * // { layout: [{ type: 'call_to_action' }] }
 * //   -> { layout: [{ type: 'call_to_action', title: null, label: 'Go', … }] }: title is missing
 * // { layout: [{ id: 'b1', type: 'call_to_action' }] }  -> as sent: b1 keeps its stored title
 * ```
 *
 * The caller's data is not changed: each row is set on a copy.
 */
export const completeNewRows = Hooks.beforeUpsert(async function completeNewRows(args) {
  let data: Dic = args.data;
  for (const { field, path, value } of walkValues(args.config.fields, args.data)) {
    for (const node of field.use.nodesFor(value)) {
      // A group or a tab is part of the row it sits in
      if (!node.storage || !isObjectLiteral(node.value) || isSaved(node.value)) continue;
      const initial = initialValues(node.fields, { event: args.event });
      // `layout.0:call_to_action` is set at `layout.0`: setValueAtPath drops the block type
      data = setValueAtPath(
        `${path}.${node.segment}`,
        data,
        withDefaultValues(node.value, initial)
      );
    }
  }
  return { ...args, data };
});
