import type { GenericBlock } from '#lib/core/prototype/types.js';
import type { FormErrors } from '#lib/panel/types.js';
import { getValueAtPath, isObjectLiteral, setValueAtPath } from '#lib/util/object.js';
import { isWithin, normalizeFieldPath } from '#lib/util/string.js';
import { isTempId, tempId } from '#lib/util/random.js';
import type { Dic } from '#lib/util/types.js';
import cloneDeep from 'clone-deep';
import { diff } from 'deep-object-diff';
import { flatten } from 'flat';

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
type BlockClipboardData = { rime: typeof CLIPBOARD_KIND; type: string; block: GenericBlock };

const CLIPBOARD_KIND = 'block';

/** `sections.0.items.2` -> `{ list: 'sections.0.items', index: 2 }` */
export const parseBlockPath = (path: string): BlockAt => {
  const normalized = normalizeFieldPath(path);
  const dot = normalized.lastIndexOf('.');
  return { list: normalized.slice(0, dot), index: parseInt(normalized.slice(dot + 1)) };
};

export const blockPath = (at: BlockAt) => `${at.list}.${at.index}`;

/**
 * The list path once the block at `removed` is gone: a list under a later sibling moves up by one.
 *
 * ```
 * shiftListPath('sections.3.items', { list: 'sections', index: 1 }) // 'sections.2.items'
 * shiftListPath('sections.0.items', { list: 'sections', index: 1 }) // 'sections.0.items'
 * ```
 */
export const shiftListPath = (list: string, removed: BlockAt) => {
  const prefix = removed.list ? `${removed.list}.` : '';
  if (!list.startsWith(prefix)) return list;
  const rest = list.slice(prefix.length);
  const [head, ...tail] = rest.split('.');
  const index = parseInt(head);
  if (Number.isNaN(index) || index < removed.index) return list;
  if (index === removed.index) return list;
  return [prefix + (index - 1), ...tail].join('.');
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

/**
 * A copy that reaches the server as new rows: a fresh temporary id on the value itself and on
 * every list item under it that has one, and `locale` set on those that carry one when it is
 * given. An `id` that is not a list item's own stays: a rich-text link's `attrs.id` names the
 * linked document. An object without an id gets none.
 *
 * ```ts
 * withFreshIds({ id: 'b1', items: [{ id: 'i1' }], body: { type: 'doc', content: [
 *   { type: 'resource', attrs: { id: 'page-42' } }] } })
 * // { id: 'temp-…', items: [{ id: 'temp-…' }], body: { …, attrs: { id: 'page-42' } } }
 * ```
 */
export const withFreshIds = <T>(value: T, options: { locale?: string } = {}): T => {
  const reset = (current: unknown, isItem: boolean): unknown => {
    if (Array.isArray(current)) return current.map((item) => reset(item, true));
    if (!isObjectLiteral(current)) return current;
    const next: Dic = {};
    for (const [key, child] of Object.entries(current)) next[key] = reset(child, false);
    if (isItem && 'id' in next) next.id = tempId();
    if (isItem && options.locale && 'locale' in next) next.locale = options.locale;
    return next;
  };
  return reset(cloneDeep(value), true) as T;
};

export const readList = (doc: Dic, list: string): GenericBlock[] =>
  cloneDeep(getValueAtPath<GenericBlock[]>(list, doc)) || [];

/** One list rewritten and set back on the document. */
const writeList = <D extends Dic>(doc: D, list: string, blocks: GenericBlock[]): D =>
  setValueAtPath(list, doc, rebuildPaths(blocks, list));

type BlocksChange<D extends Dic> = { doc: D; lists: string[] };

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

/**
 * The server's row with what was typed since `sent` laid back on top. A list that got shorter
 * comes back whole, as it is now: copying index by index would leave `undefined` where an item
 * went. An item sent with a temporary id takes the id the server saved it under.
 *
 * ```ts
 * mergeTypedSince(server, { blocks: [b0, b1, temp] }, { blocks: [b1, temp] })
 * // blocks: [b1, { ...temp, id: <the server's id> }]
 * ```
 */
export const mergeTypedSince = <D extends Dic>(server: D, sent: D, now: D): D => {
  const typedSince: Dic = flatten(diff(sent, now));
  let next = server;
  for (const path of Object.keys(typedSince)) {
    const target = shortenedList(path, now) ?? path;
    next = setValueAtPath(target, next, getValueAtPath(target, now));
  }
  const savedIds = serverIds(sent, server);
  for (const [id, path] of itemPaths(next)) {
    const saved = savedIds.get(id);
    if (saved) next = setValueAtPath(`${path}.id`, next, saved);
  }
  return next;
};

/**
 * The id the server gave each item `sent` held with a temporary one. The server saves a list item
 * for item, so its item at the same path is the one sent.
 *
 * ```ts
 * serverIds({ blocks: [{ id: 'temp-x' }] }, { blocks: [{ id: 'b3' }] }) // Map { 'temp-x' => 'b3' }
 * ```
 */
const serverIds = (sent: Dic, server: Dic) => {
  const idAt = new Map([...itemPaths(server)].map(([id, path]) => [path, id]));
  const ids = new Map<string, string>();
  for (const [id, path] of itemPaths(sent)) {
    const saved = idAt.get(path);
    if (isTempId(id) && saved) ids.set(id, saved);
  }
  return ids;
};

/** `sections.2` -> `sections` when index 2 is gone from that list in `doc`, else `null`. */
const shortenedList = (path: string, doc: Dic) => {
  const dot = path.lastIndexOf('.');
  if (dot < 0 || getValueAtPath(path, doc) !== undefined) return null;
  const list = path.slice(0, dot);
  return Array.isArray(getValueAtPath(list, doc)) ? list : null;
};

/**
 * The path of every list item that has an id, at any depth: blocks, tree items, relation rows.
 *
 * ```ts
 * itemPaths({ sections: [{ id: 'b1', items: [{ id: 'b2' }] }] })
 * // Map { 'b1' => 'sections.0', 'b2' => 'sections.0.items.0' }
 * ```
 */
export const itemPaths = (value: unknown, path = '', paths = new Map<string, string>()) => {
  const at = (key: string | number) => (path ? `${path}.${key}` : String(key));
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (isObjectLiteral(item) && typeof item.id === 'string') paths.set(item.id, at(index));
      itemPaths(item, at(index), paths);
    });
  } else if (isObjectLiteral(value)) {
    for (const [key, child] of Object.entries(value)) itemPaths(child, at(key), paths);
  }
  return paths;
};

/**
 * The errors once the items moved from `before` to `after`. A key under an item follows the item;
 * a key under an item that is gone goes; any other key stays.
 *
 * ```ts
 * // b3 goes from sections.2 to sections.1
 * rekeyErrors({ 'sections.2.title': 'required::required_field' }, before, after)
 * // { 'sections.1.title': 'required::required_field' }
 * ```
 */
export const rekeyErrors = (errors: FormErrors, before: Dic, after: Dic): FormErrors => {
  // The deepest item first: a nested block's key follows that block, not its parent
  const owners = [...itemPaths(before)].sort(([, a], [, b]) => b.length - a.length);
  const moved = itemPaths(after);
  const next: FormErrors = {};
  for (const [key, error] of Object.entries(errors)) {
    const owner = owners.find(([, path]) => key === path || key.startsWith(`${path}.`));
    if (!owner) {
      next[key] = error;
    } else if (moved.has(owner[0])) {
      next[moved.get(owner[0]) + key.slice(owner[1].length)] = error;
    }
  }
  return next;
};
