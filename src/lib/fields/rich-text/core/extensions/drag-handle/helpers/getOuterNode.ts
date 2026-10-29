import type { Node } from '@tiptap/pm/model';

/** The top-level node holding `pos`, or the node at `pos` when it is top-level itself. */
export const getOuterNode = (doc: Node, pos: number) => {
  const $pos = doc.resolve(pos);
  return $pos.depth === 0 ? doc.nodeAt(pos) : $pos.node(1);
};

/** The position before the top-level node holding `pos`; `pos` itself at the top level. */
export const getOuterNodePos = (doc: Node, pos: number) => {
  const $pos = doc.resolve(pos);
  return $pos.depth === 0 ? pos : $pos.before(1);
};
