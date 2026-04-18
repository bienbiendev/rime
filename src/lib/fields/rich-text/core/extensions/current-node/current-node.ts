import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import './current-node.css';

/**
 * Extension to add a "data-current" attributes
 * on the currently edited node
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

            if ($from.depth === 0) return;

            // Get the position + node at selection
            const pos = $from.before();
            const node = $from.node();
            if (!node) return DecorationSet.empty;

            // Create a node decoration with your custom attribute
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
