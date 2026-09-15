import type { GenericBlock } from '$lib/core/prototype/types.js';
import { getValueAtPath, isObjectLiteral, setValueAtPath } from '$lib/util/object.js';
import { normalizeFieldPath } from '$lib/util/string.js';
import { randomId } from '$lib/util/random.js';
import type { Dic } from '$lib/util/types.js';
import cloneDeep from 'clone-deep';

/**
 * The block operations, over a plain document. The form wraps them with its state, its errors
 * and its live-edit callback; every view of the blocks — the inline cards, the focus mode, the
 * shortcuts — goes through the form and lands here.
 *
 * Paths are normalized: no `:type` segment. A block path names one block, `sections.2`; a list
 * path names the array it sits in, `sections` or `sections.0.items`.
 */

/** Where a block goes: the list, and the index it will have in it. `list.length` appends. */
export type BlockAt = { list: string; index: number };

/** A block to insert: its type and its values. Id, path and position are given on the way in. */
export type NewBlock = { type: string } & Dic;

/** What the clipboard carries. */
export type BlockClipboardData = { rime: typeof CLIPBOARD_KIND; type: string; block: GenericBlock };

export const CLIPBOARD_KIND = 'block';

export const tempId = () => `temp-${randomId(8)}`;

/** `sections.0.items.2` -> `{ list: 'sections.0.items', index: 2 }` */
export const parseBlockPath = (path: string): BlockAt => {
  const normalized = normalizeFieldPath(path);
  const dot = normalized.lastIndexOf('.');
  return { list: normalized.slice(0, dot), index: parseInt(normalized.slice(dot + 1)) };
};

export const blockPath = (at: BlockAt) => `${at.list}.${at.index}`;

/** Whether `path` is `ancestor` itself or lies below it. */
export const isWithin = (path: string, ancestor: string) =>
  path === ancestor || path.startsWith(`${ancestor}.`);

/**
 * The index a list path carries at the position `removed` names, once the block at `removed` is
 * gone: a list under a later sibling moves up by one.
 *
 * ```
 * shiftListPath('sections.3.items', { list: 'sections', index: 1 }) // 'sections.2.items'
 * shiftListPath('sections.0.items', { list: 'sections', index: 1 }) // 'sections.0.items'
 * ```
 */
export const shiftListPath = (list: string, removed: BlockAt, delta = -1) => {
  const prefix = removed.list ? `${removed.list}.` : '';
  if (!list.startsWith(prefix)) return list;
  const rest = list.slice(prefix.length);
  const [head, ...tail] = rest.split('.');
  const index = parseInt(head);
  if (Number.isNaN(index) || index < removed.index) return list;
  if (index === removed.index && delta < 0) return list;
  return [prefix + (index + delta), ...tail].join('.');
};

/**
 * The path with each block index carrying its type, read off the document: what
 * `getFieldAtPath` wants.
 *
 * ```
 * withBlockTypes('sections.0.items.1', doc) // 'sections.0:grid.items.1:paragraph'
 * ```
 */
export const withBlockTypes = (path: string, doc: Dic) => {
  const parts = normalizeFieldPath(path).split('.');
  const typed: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isIndex = /^\d+$/.test(part);
    if (isIndex) {
      const item = getValueAtPath<Dic>([...parts.slice(0, i), part].join('.'), doc);
      const type = item && isObjectLiteral(item) && typeof item.type === 'string' ? item.type : '';
      typed.push(type ? `${part}:${type}` : part);
    } else {
      typed.push(part);
    }
  }
  return typed.join('.');
};

/**
 * Every `path` and `position` under a list, rewritten from the list's own path: the block's, and
 * those of the lists nested in it.
 */
export const rebuildPaths = <T extends Dic>(items: T[], listPath: string): T[] =>
  items.map((item, index) => {
    const next: Dic = cloneDeep(item);
    if ('path' in next) next.path = listPath;
    next.position = index;
    for (const key of Object.keys(next)) {
      const value = next[key];
      if (Array.isArray(value) && value.length && isObjectLiteral(value[0])) {
        next[key] = rebuildPaths(value, `${listPath}.${index}.${key}`);
      }
    }
    return next as T;
  });

/** A copy with a fresh temporary id on the block and on everything nested that has one. */
export const withFreshIds = <T extends Dic>(block: T): T => {
  const reset = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(reset);
    if (!isObjectLiteral(value)) return value;
    const next: Dic = {};
    for (const [key, child] of Object.entries(value as Dic)) next[key] = reset(child);
    if ('id' in next) next.id = tempId();
    return next;
  };
  return reset(cloneDeep(block)) as T;
};

export const readList = (doc: Dic, list: string): GenericBlock[] =>
  cloneDeep(getValueAtPath<GenericBlock[]>(list, doc)) || [];

/** One list rewritten and set back on the document. */
const writeList = <D extends Dic>(doc: D, list: string, blocks: GenericBlock[]): D =>
  setValueAtPath(list, doc, rebuildPaths(blocks, list));

export type BlocksChange<D extends Dic> = { doc: D; lists: string[] };

export const insertBlock = <D extends Dic>(
  doc: D,
  at: BlockAt,
  block: NewBlock
): BlocksChange<D> & { id: string } => {
  const id = tempId();
  const blocks = readList(doc, at.list);
  const inserted: GenericBlock = {
    ...block,
    id,
    type: block.type,
    path: at.list,
    position: at.index
  };
  blocks.splice(at.index, 0, inserted);
  return { doc: writeList(doc, at.list, blocks), lists: [at.list], id };
};

export const removeBlock = <D extends Dic>(doc: D, path: string): BlocksChange<D> => {
  const at = parseBlockPath(path);
  const blocks = readList(doc, at.list).filter((_, index) => index !== at.index);
  return { doc: writeList(doc, at.list, blocks), lists: [at.list] };
};

export const duplicateBlock = <D extends Dic>(
  doc: D,
  path: string
): BlocksChange<D> & { id: string | null } => {
  const at = parseBlockPath(path);
  const blocks = readList(doc, at.list);
  const source = blocks[at.index];
  if (!source) return { doc, lists: [], id: null };
  const copy = withFreshIds(source);
  blocks.splice(at.index + 1, 0, copy);
  return { doc: writeList(doc, at.list, blocks), lists: [at.list], id: copy.id };
};

/**
 * `to.index` is the index the block has in `to.list` once it is there — what a sortable's
 * `newIndex` says. A move into the block's own subtree is refused and changes nothing.
 */
export const moveBlock = <D extends Dic>(doc: D, from: string, to: BlockAt): BlocksChange<D> => {
  const source = parseBlockPath(from);
  const sourcePath = blockPath(source);
  if (isWithin(to.list, sourcePath)) return { doc, lists: [] };

  const sourceBlocks = readList(doc, source.list);
  const [moved] = sourceBlocks.splice(source.index, 1);
  if (!moved) return { doc, lists: [] };

  if (to.list === source.list) {
    sourceBlocks.splice(to.index, 0, moved);
    return { doc: writeList(doc, source.list, sourceBlocks), lists: [source.list] };
  }

  // The source list first; the target may hang under one of its later siblings and shift.
  let next = writeList(doc, source.list, sourceBlocks);
  const targetList = shiftListPath(to.list, source);
  const targetBlocks = readList(next, targetList);
  targetBlocks.splice(to.index, 0, moved);
  next = writeList(next, targetList, targetBlocks);
  return { doc: next, lists: [source.list, targetList] };
};

export const toClipboard = (block: GenericBlock): BlockClipboardData => ({
  rime: CLIPBOARD_KIND,
  type: block.type,
  block: cloneDeep(block)
});

/** The block a clipboard text holds, or `null` when the text is something else. */
export const fromClipboard = (text: string): BlockClipboardData | null => {
  try {
    const data = JSON.parse(text);
    if (!isObjectLiteral(data) || data.rime !== CLIPBOARD_KIND) return null;
    if (typeof data.type !== 'string' || !isObjectLiteral(data.block)) return null;
    return data as BlockClipboardData;
  } catch {
    return null;
  }
};
