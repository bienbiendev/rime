import type { IconProps } from '@lucide/svelte';
import type { Editor, EditorOptions, JSONContent, Range } from '@tiptap/core';
import type { Component, Snippet } from 'svelte';
import type { RichTextContext } from '../component/context.svelte.js';

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

/**
 * What `RenderRichText` passes a component of `components`: the stored node, as saved. A `link`
 * component writes `href` itself, so it checks it first:
 *
 * ```svelte
 * <a href={isSafeUrl(href) ? href : undefined}>{@render children?.()}</a>
 * ```
 *
 * with `isSafeUrl` from `rimecms/util` (`url.isSafeUrl`).
 *
 * A `media` component gets the media as the reader sees it now, in `attrs`: `url`, `sizes`,
 * `title`, `mimeType`, `filename`. A `resource` component gets its document the same way: `title`,
 * `_type`, `_thumbnail`. They are `null` for a document the reader may not read, or a missing one.
 */
export type RichTextNodeRendererProps = {
  node: JSONContent;
  components?: Record<string, RichTextNodeRenderer>;
  children?: Snippet;
};
export type RichTextNodeRenderer = Component<RichTextNodeRendererProps>;

export type { RichTextContext };
