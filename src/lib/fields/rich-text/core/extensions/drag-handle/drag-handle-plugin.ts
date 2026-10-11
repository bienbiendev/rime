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

export interface DragHandlePluginProps {
  pluginKey: PluginKey | string;
  editor: Editor;
  element: HTMLElement;
  computePositionConfig?: ComputePositionConfig;
}

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
    if (!element) {
      return;
    }

    element.style.visibility = 'hidden';
    element.style.pointerEvents = 'none';
  }

  function showHandle() {
    if (!element) {
      return;
    }

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
      if (element) {
        element.style.pointerEvents = 'none';
      }
    }, 0);
  }

  function onDragEnd() {
    hideHandle();
    if (element) {
      element.style.pointerEvents = 'auto';
    }
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
          // Something has changed and drag handler is visible: map the position through the change.
          // The view's update method then reads the outer node at the new position.
          if (tr.docChanged && currentNodePos !== -1 && element) {
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
            if (!element) {
              return;
            }

            if (!editor.isEditable) {
              hideHandle();
              return;
            }

            // Recalculate popup position if doc has changed and drag handler is visible.
            if (view.state.doc.eq(oldState.doc) || currentNodePos === -1) {
              return;
            }

            // Get domNode from (new) position.
            let domNode = view.nodeDOM(currentNodePos) as HTMLElement;

            // Since old element could have been wrapped, we need to find
            // the outer node and take its position and node data.
            domNode = getOuterDomNode(view, domNode);

            // Skip if domNode is editor dom.
            if (domNode === view.dom) {
              return;
            }

            // We only want `Element`.
            if (domNode?.nodeType !== 1) {
              return;
            }

            const domNodePos = view.posAtDOM(domNode, 0);
            const outerNode = getOuterNode(editor.state.doc, domNodePos);
            const outerNodePos = getOuterNodePos(editor.state.doc, domNodePos);

            currentNode = outerNode;
            currentNodePos = outerNodePos;

            repositionDragHandle(domNode as Element);
          },

          destroy() {
            if (rafId) {
              cancelAnimationFrame(rafId);
              rafId = null;
              pendingMouseCoords = null;
            }

            if (element) {
              removeNode(wrapper);
            }
          }
        };
      },

      props: {
        handleDOMEvents: {
          keydown(view) {
            if (!element) {
              return false;
            }

            if (view.hasFocus()) {
              hideHandle();
              currentNode = null;
              currentNodePos = -1;

              // We want to still continue with other keydown events.
              return false;
            }

            return false;
          },
          mouseleave(_view, e) {
            // Hide unless the pointer moved into the wrapper.
            if (e.target && !wrapper.contains(e.relatedTarget as HTMLElement)) {
              hideHandle();

              currentNode = null;
              currentNodePos = -1;
            }

            return false;
          },

          mousemove(view, e) {
            // Do not continue if popup is not initialized.
            if (!element) {
              return false;
            }

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

              const nodeData = findElementNextToCoords({
                x,
                y,
                direction: 'right',
                editor
              });

              // Skip if there is no node next to coords
              if (!nodeData.resultElement) {
                return;
              }

              let domNode = nodeData.resultElement as HTMLElement;

              domNode = getOuterDomNode(view, domNode);

              // Skip if domNode is editor dom.
              if (domNode === view.dom) {
                return;
              }

              // We only want `Element`.
              if (domNode?.nodeType !== 1) {
                return;
              }

              const domNodePos = view.posAtDOM(domNode, 0);
              const outerNode = getOuterNode(editor.state.doc, domNodePos);

              if (outerNode !== currentNode) {
                const outerNodePos = getOuterNodePos(editor.state.doc, domNodePos);

                currentNode = outerNode;
                currentNodePos = outerNodePos;

                // Set nodes clientRect.
                repositionDragHandle(domNode as Element);

                showHandle();
              }
            });

            return false;
          }
        }
      }
    })
  };
};
