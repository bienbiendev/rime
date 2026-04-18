import type { IconProps } from '@lucide/svelte';
import type { Editor, EditorOptions, JSONContent, Range } from '@tiptap/core';
import type { Component, Snippet } from 'svelte';
import type { RichTextContext } from '../component/context.svelte.js';

export type RichTextFeatureType = 'mark' | 'node';

export type RichTextFeatureSuggestion = {
  command: (args: { editor: Editor; range?: Range }) => void;
};

export type RichTextFeature = {
  extension?: EditorOptions['extensions'][number];
  marks?: RichTextFeatureMark[];
  nodes?: RichTextFeatureNode[];
};

export type RichTextFeatureMark = Omit<RichTextFeatureNode, 'nodeSelector'>;
export type RichTextFeatureNode = {
  label: string;
  icon: Component<IconProps>;
  isActive?: (args: { editor: Editor; range?: Range }) => boolean;
  nodeSelector?: {
    command: (args: { editor: Editor; range?: Range }) => void;
  };
  bubbleMenu?: {
    command?: (args: { editor: Editor; range?: Range }) => void;
    component?: Component<{
      editor: Editor;
      path: string;
      active: boolean;
      context: RichTextContext;
      options?: any;
    }>;
  };
  suggestion?: {
    command: (args: { editor: Editor; range?: Range }) => void;
  };
};

export type RichTextEditorConfig = {
  tiptap: Partial<EditorOptions>;
  features: RichTextFeature[];
};

export interface TiptapNodeViewContext {
  onDragStart: (event: DragEvent) => void;
}

export type ComponentInputProps<T> = Partial<T> & {
  editor: Editor;
  class?: string;
  children?: Snippet;
};

export type RichTextNodeRendererProps = {
  node: JSONContent;
  components?: Record<string, RichTextNodeRenderer>;
  children?: Snippet;
};
export type RichTextNodeRenderer = Component<RichTextNodeRendererProps>;

export type { RichTextContext };
