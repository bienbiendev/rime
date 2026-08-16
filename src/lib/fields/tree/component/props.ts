import type { TreeBlock } from '$lib/core/types/doc.js';
import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { Dic } from '$lib/util/types.js';
import type { TreeBuilder } from '../index.js';

export type TreeProps = {
  path: string;
  config: TreeBuilder;
  form: DocumentFormContext;
};

export type TreeBlockProps = {
  path: string;
  sorting: boolean;
  treeState: {
    addItem: (emptyValues: Dic) => void;
    moveItem: (fromPath: string, toPath: string) => void;
    deleteItem: (path: string, index: number) => void;
    readonly path: string;
    readonly stamp: string;
    readonly items: TreeBlock[];
  };
  form: DocumentFormContext;
  config: TreeBuilder;
  treeKey: string;
};
