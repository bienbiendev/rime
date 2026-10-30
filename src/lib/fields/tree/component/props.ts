import type { TreeBlock } from '#lib/core/prototype/types.js';
import type { DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
import type { Dic } from '#lib/util/types.js';
import type { Action } from 'svelte/action';
import type { TreeBuilder } from '../index.js';

export type TreeProps = {
  path: string;
  config: TreeBuilder;
  form: DocumentFormContext;
};

export type TreeBlockProps = {
  path: string;
  treeState: {
    /** At the end of the tree, or of the list `atPath` names: `links.0._children`. */
    addItem: (emptyValues: Dic, atPath?: string) => void;
    moveItem: (fromPath: string, toPath: string) => void;
    deleteItem: (path: string, index: number) => void;
    readonly path: string;
    readonly stamp: string;
    readonly items: TreeBlock[];
  };
  form: DocumentFormContext;
  config: TreeBuilder;
  /** Makes a list of the tree sortable: the tree's own, so every list shares its group. */
  sortableList: Action<HTMLElement>;
};
