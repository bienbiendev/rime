// Based on https://github.com/ueberdosis/tiptap/tree/main/packages/extension-drag-handle
import { type ComputePositionConfig, type VirtualElement, computePosition } from '@floating-ui/dom';
import type { Editor } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { type Transaction, Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

import { dragHandler } from './helpers/dragHandler.js';
import { findElementNextToCoords } from './helpers/findNextElementFromCursor.js';
import { getOuterNode, getOuterNodePos } from './helpers/getOuterNode.js';
import { removeNode } from './helpers/removeNode.js';

/** The child of the editor's root element that holds `domNode`. */
const getOuterDomNode = (view: EditorView, domNode: HTMLElement) => {
  let tmpDomNode = domNode;

  // Traverse to top level node.
  while (tmpDomNode?.parentNode) {
    if (tmpDomNode.parentNode === view.dom) {
      break;
    }

    tmpDomNode = tmpDomNode.parentNode as HTMLElement;
  }

  return tmpDomNode;
};

// The top-level block holding `dom`: its element, node and position; null outside a block
const outerBlockAt = (view: EditorView, dom: globalThis.Node | null) => {
  const outer = dom && getOuterDomNode(view, dom as HTMLElement);
  if (!outer || outer === view.dom || outer.nodeType !== 1) {
    return null;
  }
  const pos = view.posAtDOM(outer, 0);
  const { doc } = view.state;
  return { dom: outer, node: getOuterNode(doc, pos), pos: getOuterNodePos(doc, pos) };
};

export interface DragHandlePluginProps {
  pluginKey: PluginKey | string;
  editor: Editor;
  element: HTMLElement;
  computePositionConfig?: ComputePositionConfig;
}

/**
 * The drag handle as a ProseMirror plugin. It moves `element` into a wrapper placed beside the
 * editor, shows it next to the top-level block under the pointer, and starts a drag of that
 * block from it. drag-handle.svelte registers `plugin` and calls `unbind` when it goes.
 */
export const DragHandlePlugin = ({
  pluginKey,
  element,
  editor,
  computePositionConfig
}: DragHandlePluginProps) => {
  const wrapper = document.createElement('div');
  let currentNode: Node | null = null;
  let currentNodePos = -1;
  let rafId: number | null = null;
  let pendingMouseCoords: { x: number; y: number } | null = null;

  function hideHandle() {
    element.style.visibility = 'hidden';
    element.style.pointerEvents = 'none';
  }

  function showHandle() {
    if (!editor.isEditable) {
      hideHandle();
      return;
    }

    element.style.visibility = '';
    element.style.pointerEvents = 'auto';
  }

  /**
   * The first line of the node: under its top padding, one line high, whatever the node holds.
   * The handle centres on it, so a paragraph and a media node get it at the same place.
   */
  function firstLineOf(dom: Element): VirtualElement {
    return {
      getBoundingClientRect: () => {
        const rect = dom.getBoundingClientRect();
        const style = getComputedStyle(dom);
        const paddingTop = parseFloat(style.paddingTop) || 0;
        const lineHeight =
          style.lineHeight === 'normal'
            ? parseFloat(style.fontSize) * 1.2
            : parseFloat(style.lineHeight);
        const height = Math.min(lineHeight || rect.height, rect.height);
        const top = rect.top + paddingTop;
        return {
          x: rect.left,
          y: top,
          top,
          left: rect.left,
          right: rect.right,
          bottom: top + height,
          width: rect.width,
          height
        };
      }
    };
  }

  function repositionDragHandle(dom: Element) {
    computePosition(firstLineOf(dom), element, computePositionConfig).then((val) => {
      Object.assign(element.style, {
        position: val.strategy,
        left: `${val.x}px`,
        top: `${val.y}px`
      });
    });
  }

  function onDragStart(e: DragEvent) {
    dragHandler(e, editor);

    // The handle stops catching the pointer once the drag has started. Done at once, the drag
    // position is wrong when the handle is `position: absolute`.
    setTimeout(() => {
      element.style.pointerEvents = 'none';
    }, 0);
  }

  // The handle hides; the next hover shows it again, on whichever block it is
  function onDragEnd() {
    hideHandle();
    element.style.pointerEvents = 'auto';
    currentNode = null;
    currentNodePos = -1;
  }

  element.addEventListener('dragstart', onDragStart);
  element.addEventListener('dragend', onDragEnd);

  wrapper.appendChild(element);

  return {
    unbind() {
      element.removeEventListener('dragstart', onDragStart);
      element.removeEventListener('dragend', onDragEnd);
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
        pendingMouseCoords = null;
      }
    },
    plugin: new Plugin({
      key: typeof pluginKey === 'string' ? new PluginKey(pluginKey) : pluginKey,

      state: {
        init() {
          return null;
        },
        apply(tr: Transaction) {
          // A change moves the hovered block: its position follows, and the view's update reads
          // the block at the new position. The plugin state itself stays null.
          if (tr.docChanged && currentNodePos !== -1) {
            currentNodePos = tr.mapping.map(currentNodePos);
          }

          return null;
        }
      },

      view: (view) => {
        element.draggable = true;
        element.style.pointerEvents = 'auto';

        editor.view.dom.parentElement?.appendChild(wrapper);

        wrapper.style.pointerEvents = 'none';
        wrapper.style.position = 'absolute';
        wrapper.style.top = '0';
        wrapper.style.left = '0';

        return {
          update(_, oldState) {
            if (!editor.isEditable) {
              hideHandle();
              return;
            }

            // A change moved the hovered block: the handle follows it.
            if (view.state.doc.eq(oldState.doc) || currentNodePos === -1) {
              return;
            }

            const block = outerBlockAt(view, view.nodeDOM(currentNodePos));
            if (!block) {
              return;
            }
            currentNode = block.node;
            currentNodePos = block.pos;
            repositionDragHandle(block.dom);
          },

          destroy() {
            if (rafId) {
              cancelAnimationFrame(rafId);
              rafId = null;
              pendingMouseCoords = null;
            }

            removeNode(wrapper);
          }
        };
      },

      props: {
        handleDOMEvents: {
          keydown(view) {
            // Typing hides the handle; the key still reaches the editor.
            if (view.hasFocus()) {
              hideHandle();
              currentNode = null;
              currentNodePos = -1;
            }
            return false;
          },
          mouseleave(_view, e) {
            // Hide unless the pointer moved into the wrapper.
            if (!wrapper.contains(e.relatedTarget as HTMLElement)) {
              hideHandle();
              currentNode = null;
              currentNodePos = -1;
            }
            return false;
          },

          mousemove(view, e) {
            // Store latest mouse coords and schedule a single RAF per frame
            pendingMouseCoords = { x: e.clientX, y: e.clientY };

            if (rafId) {
              return false;
            }

            rafId = requestAnimationFrame(() => {
              rafId = null;

              if (!pendingMouseCoords) {
                return;
              }

              const { x, y } = pendingMouseCoords;
              pendingMouseCoords = null;

              const found = findElementNextToCoords({ x, y, editor });
              const block = outerBlockAt(view, found.resultElement);
              if (!block || block.node === currentNode) {
                return;
              }
              currentNode = block.node;
              currentNodePos = block.pos;
              repositionDragHandle(block.dom);
              showHandle();
            });

            return false;
          }
        }
      }
    })
  };
};
