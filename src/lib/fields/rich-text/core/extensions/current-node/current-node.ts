import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import './current-node.css';

/**
 * Marks with `data-current` the innermost block where the selection starts, a paragraph inside
 * a list item for example. current-node.css lifts the top-level node that holds it.
 */
export const CurrentNodeAttribute = Extension.create({
  name: 'currentNodeAttribute',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('current-node-attribute'),
        state: {
          init: () => DecorationSet.empty,
          apply: (tr) => {
            const { selection } = tr;
            const { $from } = selection;

            // A selection at the top level, a selected block or the whole document, marks nothing
            if ($from.depth === 0) return;

            const pos = $from.before();
            const node = $from.node();
            const deco = Decoration.node(pos, pos + node.nodeSize, {
              'data-current': ''
            });

            return DecorationSet.create(tr.doc, [deco]);
          }
        },
        props: {
          decorations(state) {
            return this.getState(state);
          }
        }
      })
    ];
  }
});
