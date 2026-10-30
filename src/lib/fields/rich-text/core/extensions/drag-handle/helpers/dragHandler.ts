import type { Editor } from '@tiptap/core';
import { getSelectionRanges, NodeRangeSelection } from '@tiptap/extension-node-range';
import type { SelectionRange } from '@tiptap/pm/state';

import { cloneElement } from './cloneElement.js';
import { findElementNextToCoords } from './findNextElementFromCursor.js';
import { getInnerCoords } from './getInnerCoords.js';
import { removeNode } from './removeNode.js';

/** The range of the top-level block right of the pointer, or none. */
function getDragHandleRanges(event: DragEvent, editor: Editor): SelectionRange[] {
  const { doc } = editor.view.state;

  const result = findElementNextToCoords({ editor, x: event.clientX, y: event.clientY });

  if (!result.resultNode || result.pos === null) {
    return [];
  }

  const coords = getInnerCoords(editor.view, event.clientX, event.clientY);
  const posAtCoords = editor.view.posAtCoords(coords);

  // No position at the pointer's height: nothing to drag
  if (!posAtCoords) {
    return [];
  }

  const $from = doc.resolve(result.pos);
  const $to = doc.resolve(result.pos + 1);

  return getSelectionRanges($from, $to, 0);
}

/**
 * Starts a drag from the handle: the hovered block, or the whole selection when the block is
 * part of it. It selects what moves, hands ProseMirror the content to move, and draws a copy
 * of the blocks as the drag image.
 */
export function dragHandler(event: DragEvent, editor: Editor) {
  const { view } = editor;

  if (!event.dataTransfer) {
    return;
  }

  const { empty, $from, $to } = view.state.selection;

  const dragHandleRanges = getDragHandleRanges(event, editor);

  const selectionRanges = getSelectionRanges($from, $to, 0);
  const isDragHandleWithinSelection = selectionRanges.some((range) =>
    dragHandleRanges.some(
      (handle) => handle.$from.pos === range.$from.pos && handle.$to.pos === range.$to.pos
    )
  );

  const ranges = empty || !isDragHandleWithinSelection ? dragHandleRanges : selectionRanges;

  if (!ranges.length) {
    return;
  }

  const { tr } = view.state;
  const wrapper = document.createElement('div');
  const from = ranges[0].$from.pos;
  const to = ranges[ranges.length - 1].$to.pos;

  const selection = NodeRangeSelection.create(view.state.doc, from, to);
  const slice = selection.content();

  ranges.forEach((range) => {
    const element = view.nodeDOM(range.$from.pos) as HTMLElement;
    const clonedElement = cloneElement(element);

    wrapper.append(clonedElement);
  });

  wrapper.style.position = 'absolute';
  wrapper.style.top = '-10000px';
  document.body.append(wrapper);

  event.dataTransfer.clearData();
  event.dataTransfer.setDragImage(wrapper, 0, 0);

  // tell ProseMirror the dragged content
  view.dragging = { slice, move: true };

  tr.setSelection(selection);

  view.dispatch(tr);

  // The drag image goes when the drag ends, dropped or cancelled
  document.addEventListener('dragend', () => removeNode(wrapper), { once: true });
}
