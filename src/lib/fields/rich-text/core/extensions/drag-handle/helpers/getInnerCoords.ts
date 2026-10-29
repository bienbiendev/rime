import type { EditorView } from '@tiptap/pm/view';

import { minMax } from './minMax.js';

/** The pointer's coordinates with `x` held inside the editor's content box. */
export function getInnerCoords(
  view: EditorView,
  x: number,
  y: number
): { left: number; top: number } {
  const style = window.getComputedStyle(view.dom);
  const paddingLeft = parseInt(style.paddingLeft, 10);
  const paddingRight = parseInt(style.paddingRight, 10);
  const borderLeft = parseInt(style.borderLeftWidth, 10);
  const borderRight = parseInt(style.borderRightWidth, 10);
  const bounds = view.dom.getBoundingClientRect();
  const coords = {
    left: minMax(
      x,
      bounds.left + paddingLeft + borderLeft,
      bounds.right - paddingRight - borderRight
    ),
    top: y
  };

  return coords;
}
