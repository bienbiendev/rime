import { pushState, replaceState } from '$app/navigation';
import { page } from '$app/state';
import { emptyValuesFromFieldConfig } from '$lib/core/fields/util.js';
import type { GenericBlock } from '$lib/core/prototype/types.js';
import type { BlocksBuilder, BlocksFieldBlock } from '$lib/fields/blocks/index.js';
import {
  blockPath,
  parseBlockPath,
  shiftListPath,
  type BlockAt
} from '$lib/panel/context/blocks-ops.js';
import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import { capitalize } from '$lib/util/string.js';
import { getContext, setContext } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

const KEY = 'rime.blocks-focus';

/** The query parameter that names the list focus is open on: `?focus=layout.sections`. */
export const FOCUS_PARAM = 'focus';

type PageState = { blocksFocus?: string };

/** One step of the way down to the open list: a blocks field, or the block an index names. */
export type Crumb = { label: string; list: string; block?: string };

/** One row of the layers: a block, where it sits, and the lists it holds. */
export type LayerRow = {
  /** The block's path, `sections.0.items.2`. */
  path: string;
  list: string;
  index: number;
  depth: number;
  block: GenericBlock;
  config: BlocksFieldBlock | undefined;
  title: string;
  /** One entry per `blocks` field of the block. */
  children: { list: string; builder: BlocksBuilder; label: string }[];
};

/**
 * The focus mode of one blocks field: which list it is open on, which blocks are selected, which
 * rows are folded. The document form is the only state it writes to; a page reload with
 * `?focus=` in the address reopens it.
 *
 * The selection drives the stage: a block, or nothing, which is the root node of the layers and
 * shows the whole list.
 *
 * A focus opened from the field rides in `page.state`, so Escape, the close button and the back
 * button all do the same thing. One opened by the address has no history entry of its own: the
 * router is not ready for one while the page mounts, and closing it rewrites the address instead.
 */
export function setBlocksFocusContext(form: DocumentFormContext) {
  let fromUrl = $state<string | null>(page.url.searchParams.get(FOCUS_PARAM));
  const path = $derived(((page.state as PageState).blocksFocus ?? fromUrl) || null);
  let selection = $state<string[]>([]);
  const collapsed = new SvelteSet<string>();
  let openedHere = false;

  $effect(() => {
    if (path) return;
    selection = [];
    collapsed.clear();
  });

  const locked = $derived(form.isDisabled || form.readOnly);

  const urlWith = (list: string | null) => {
    const url = new URL(page.url);
    if (list) url.searchParams.set(FOCUS_PARAM, list);
    else url.searchParams.delete(FOCUS_PARAM);
    return url;
  };

  function open(list: string, selected?: string) {
    openedHere = true;
    fromUrl = null;
    pushState(urlWith(list), { blocksFocus: list } as App.PageState);
    selection = selected ? [selected] : [];
  }

  function close() {
    if (openedHere) {
      openedHere = false;
      history.back();
    } else {
      fromUrl = null;
      replaceState(urlWith(null), {} as App.PageState);
    }
  }

  /* ---------------------------------------------------------------- rows */

  const builderOf = (list: string) => form.blocks.builder(list);

  const configOf = (list: string, block: GenericBlock) =>
    builderOf(list)?.get.blocks.find((candidate) => candidate.name === block.type)?.get;

  function titleOf(config: BlocksFieldBlock | undefined, block: GenericBlock, index: number) {
    if (config?.renderTitle) {
      try {
        const title = config.renderTitle({ values: block, position: index });
        if (title) return title;
      } catch (error) {
        console.error(`Can't render title in block`, error);
      }
    }
    return config?.label || capitalize(block.type);
  }

  function rowsOf(list: string, depth = 0): LayerRow[] {
    return form.blocks.list(list).map((block, index) => {
      const config = configOf(list, block);
      const rowPath = `${list}.${index}`;
      const children = (config?.fields ?? [])
        .filter((field): field is BlocksBuilder => field.type === 'blocks')
        .map((field) => ({
          list: `${rowPath}.${field.name}`,
          builder: field,
          label: field.get.label || capitalize(field.name)
        }));
      return {
        path: rowPath,
        list,
        index,
        depth,
        block,
        config,
        title: titleOf(config, block, index),
        children
      };
    });
  }

  /** Every row, folded ones included, in layers order. */
  function allRows(): LayerRow[] {
    if (!path) return [];
    const out: LayerRow[] = [];
    const walk = (list: string, depth: number) => {
      for (const row of rowsOf(list, depth)) {
        out.push(row);
        for (const child of row.children) walk(child.list, depth + 1);
      }
    };
    walk(path, 0);
    return out;
  }

  /** The rows on screen: what the arrow keys walk. */
  function visibleRows(): LayerRow[] {
    if (!path) return [];
    const out: LayerRow[] = [];
    const walk = (list: string, depth: number) => {
      for (const row of rowsOf(list, depth)) {
        out.push(row);
        if (collapsed.has(row.path)) continue;
        for (const child of row.children) walk(child.list, depth + 1);
      }
    };
    walk(path, 0);
    return out;
  }

  /**
   * The root node of the layers: the blocks field's label, or the block the open list hangs off,
   * with the field's label after it when that block holds several lists.
   */
  function rootLabel(): string {
    if (!path) return '';
    const builder = builderOf(path);
    const fieldLabel = builder?.get.label || capitalize(builder?.name || '');
    const crumbs = breadcrumb();
    const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined;
    if (!parent?.block) return fieldLabel;
    const block = form.blocks.list(parent.list)[parseBlockPath(parent.block).index];
    const lists = block
      ? (configOf(parent.list, block)?.fields ?? []).filter((f) => f.type === 'blocks')
      : [];
    return lists.length > 1 ? `${parent.label} › ${fieldLabel}` : parent.label;
  }

  /**
   * The way down to the open list, blocks fields and blocks only: `sections.1.items` reads
   * *Sections › Grid › Items*. A container segment, a tab or a group, adds nothing.
   */
  function breadcrumb(): Crumb[] {
    if (!path) return [];
    const crumbs: Crumb[] = [];
    let list = '';
    for (const part of path.split('.')) {
      if (/^\d+$/.test(part)) {
        const index = parseInt(part);
        const block = form.blocks.list(list)[index];
        if (!block) continue;
        crumbs.push({
          label: titleOf(configOf(list, block), block, index),
          list,
          block: `${list}.${index}`
        });
        continue;
      }
      list = list ? `${list}.${part}` : part;
      const builder = builderOf(list);
      if (builder) crumbs.push({ label: builder.get.label || capitalize(part), list });
    }
    return crumbs;
  }

  /** The lists a block of `type` may go to, the one it is in and its own subtree left out. */
  function moveTargets(): { list: string; label: string }[] {
    const current = currentAt();
    if (!path || !current) return [];
    const currentPath = blockPath(current);
    const type = form.blocks.list(current.list)[current.index]?.type;
    if (!type) return [];
    const rootBuilder = builderOf(path);
    const targets: { list: string; label: string }[] = [];
    if (form.blocks.accepts(path, type) && current.list !== path) {
      targets.push({
        list: path,
        label: rootBuilder?.get.label || capitalize(rootBuilder?.name || '')
      });
    }
    for (const row of allRows()) {
      if (row.path === currentPath || row.path.startsWith(`${currentPath}.`)) continue;
      for (const child of row.children) {
        if (child.list === current.list) continue;
        if (!form.blocks.accepts(child.list, type)) continue;
        targets.push({ list: child.list, label: `${row.title} › ${child.label}` });
      }
    }
    return targets;
  }

  /* ----------------------------------------------------------- selection */

  const currentAt = (): BlockAt | null => (selection[0] ? parseBlockPath(selection[0]) : null);

  function select(rowPath: string, options: { extend?: boolean } = {}) {
    if (options.extend && selection.length) {
      selection = selection.includes(rowPath)
        ? selection.filter((item) => item !== rowPath)
        : [rowPath, ...selection];
    } else {
      selection = [rowPath];
    }
  }

  /** Up from the first row lands on the root node; down from the root on the first row. */
  function selectRelative(delta: number, extend = false) {
    const rows = visibleRows();
    if (!rows.length) return;
    const index = rows.findIndex((row) => row.path === selection[0]);
    const target = index + delta;
    if (target < 0) return selectRoot();
    const next = rows[Math.min(rows.length - 1, target)];
    if (next) select(next.path, { extend });
  }

  const selectRoot = () => {
    selection = [];
  };

  /* ---------------------------------------------------------- operations */

  /** Where the palette inserts: after the current block, else at the end of the open list. */
  function insertionPoint(): BlockAt | null {
    const current = currentAt();
    if (current) return { list: current.list, index: current.index + 1 };
    if (!path) return null;
    return { list: path, index: form.blocks.list(path).length };
  }

  function insertType(type: string, at = insertionPoint()): string | null {
    if (locked || !at) return null;
    const config = builderOf(at.list)?.get.blocks.find((candidate) => candidate.name === type)?.get;
    if (!config) return null;
    const empty = { ...emptyValuesFromFieldConfig(config.fields), type };
    const id = form.blocks.insert(at, empty);
    select(blockPath(at));
    return id;
  }

  function duplicateSelection() {
    const current = currentAt();
    if (locked || !current) return;
    form.blocks.duplicate(blockPath(current));
    select(blockPath({ list: current.list, index: current.index + 1 }));
  }

  /** Removes the selected blocks, last in layers order first, so earlier paths hold. */
  function removeSelection() {
    if (locked || !selection.length) return;
    const order = visibleRows().map((row) => row.path);
    const targets = [...selection].sort((a, b) => order.indexOf(b) - order.indexOf(a));
    for (const target of targets) form.blocks.remove(target);
    const first = parseBlockPath(targets[targets.length - 1]);
    const remaining = form.blocks.list(first.list);
    if (!remaining.length) {
      selection = [];
      return;
    }
    select(blockPath({ list: first.list, index: Math.min(first.index, remaining.length - 1) }));
  }

  function moveSelection(delta: number) {
    const current = currentAt();
    if (locked || !current) return;
    const index = current.index + delta;
    if (index < 0 || index >= form.blocks.list(current.list).length) return;
    form.blocks.move(blockPath(current), { list: current.list, index });
    select(blockPath({ list: current.list, index }));
  }

  function moveSelectionInto(list: string) {
    const current = currentAt();
    if (locked || !current) return;
    const index = form.blocks.list(list).length;
    form.blocks.move(blockPath(current), { list, index });
    const landed = shiftListPath(list, current);
    select(blockPath({ list: landed, index }));
  }

  function copySelection() {
    const current = currentAt();
    if (!current) return Promise.resolve();
    return form.blocks.copy(blockPath(current));
  }

  async function pasteAfterSelection() {
    const at = insertionPoint();
    if (locked || !at) return null;
    const id = await form.blocks.paste(at);
    if (id) select(blockPath(at));
    return id;
  }

  /* ------------------------------------------------------------ folding */

  const setCollapsed = (rowPath: string, value: boolean) =>
    value ? collapsed.add(rowPath) : collapsed.delete(rowPath);

  const collapseAll = () => {
    for (const row of allRows()) if (row.children.length) collapsed.add(row.path);
  };

  const store = {
    get path() {
      return path;
    },
    get selection() {
      return selection;
    },
    get current() {
      return currentAt();
    },
    get currentRow() {
      const current = currentAt();
      return current
        ? (rowsOf(current.list).find((row) => row.index === current.index) ?? null)
        : null;
    },
    get locked() {
      return locked;
    },
    /** The open list's block set has at least one render: the stage is the stack of renders. */
    get hasRenders() {
      return !!path && !!builderOf(path)?.get.blocks.some((block) => block.get.render);
    },
    /** Nothing selected: the root node, and the whole list on the stage. */
    get rootSelected() {
      return selection.length === 0;
    },
    rootLabel,
    selectRoot,
    breadcrumb,
    isSelected: (rowPath: string) => selection.includes(rowPath),
    isCollapsed: (rowPath: string) => collapsed.has(rowPath),
    open,
    close,
    rowsOf,
    allRows,
    visibleRows,
    moveTargets,
    select,
    selectRelative,
    insertionPoint,
    insertType,
    duplicateSelection,
    removeSelection,
    moveSelection,
    moveSelectionInto,
    copySelection,
    pasteAfterSelection,
    setCollapsed,
    toggleCollapsed: (rowPath: string) => setCollapsed(rowPath, !collapsed.has(rowPath)),
    collapseAll,
    expandAll: () => collapsed.clear()
  };

  return setContext(KEY, store);
}

export type BlocksFocus = ReturnType<typeof setBlocksFocusContext>;

/** The focus of the document on screen, or nothing in a form that has none: a nested create. */
export const getBlocksFocusContext = () => getContext<BlocksFocus | undefined>(KEY);
