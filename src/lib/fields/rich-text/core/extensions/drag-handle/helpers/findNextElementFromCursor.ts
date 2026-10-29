import type { Editor } from '@tiptap/core';

export type FindElementNextToCoords = { x: number; y: number; editor: Editor };

/**
 * The first top-level element of the editor crossing a 10px band around the pointer, to its
 * right, with its node and position; all null when there is none.
 */
export const findElementNextToCoords = ({ x, y, editor }: FindElementNextToCoords) => {
  // A band 5px above and below the pointer, from the pointer to the window's right edge
  const rect = { top: y - 5, bottom: y + 5, left: x, right: window.innerWidth };

  const root = editor.view.dom as HTMLElement;

  // The editor's top-level elements that cross the band, in document order
  const candidates = [...root.children]
    .filter((candidate) => {
      return editor.view.posAtDOM(candidate, 0) >= 0;
    })
    .filter((candidate) => {
      const candidateRect = candidate.getBoundingClientRect();
      return !(
        candidateRect.bottom < rect.top ||
        candidateRect.top > rect.bottom ||
        candidateRect.right < rect.left ||
        candidateRect.left > rect.right
      );
    });

  if (candidates.length === 0) {
    return { resultElement: null, resultNode: null, pos: null };
  }

  const finalCandidate = candidates[0];
  const candidatePos = editor.view.posAtDOM(finalCandidate, 0);
  const $pos = editor.state.doc.resolve(candidatePos);

  if ($pos.nodeAfter) {
    const nodeAfterDom = editor.view.nodeDOM($pos.pos);

    if (nodeAfterDom && nodeAfterDom === finalCandidate) {
      return {
        resultElement: finalCandidate,
        resultNode: $pos.nodeAfter,
        pos: candidatePos
      };
    }
  }

  const candidateNode = editor.state.doc.nodeAt(candidatePos - 1);

  return { resultElement: finalCandidate, resultNode: candidateNode, pos: candidatePos };
};
