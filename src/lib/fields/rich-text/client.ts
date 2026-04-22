import type { Level } from '@tiptap/extension-heading';
import { BlockquoteFeature } from './core/features/blockquote.js';
import { BoldFeature } from './core/features/bold.js';
import { BulletListFeature } from './core/features/bullet-list.js';
import { FieldsFeature, type FieldsFeatureOptions } from './core/features/fields/index.js';
import { HeadingFeature } from './core/features/heading.js';
import { HorizontalRuleFeature } from './core/features/hr/hr.js';
import { ItalicFeature } from './core/features/italic.js';
import { LinkFeature } from './core/features/link/index.js';
import { OrderedListFeature } from './core/features/ordered-list.js';
import { ParagraphFeature } from './core/features/paragraph.js';
import { ResourceFeature } from './core/features/resource/index.js';
import type { RichTextResource } from './core/features/resource/types.js';
import { UploadFeature } from './core/features/upload/index.js';
import RenderRichText from './core/render-rich-text.svelte';
import SvelteNodeViewRenderer from './core/svelte/node-view-renderer.svelte';
import NodeViewWrapper from './core/svelte/node-view-wrapper.svelte';
import type { RichTextNodeRenderer, RichTextNodeRendererProps } from './core/types.js';
import { richTextJSONToText } from './index.js';

export const fields = (args: FieldsFeatureOptions) => FieldsFeature(args);
export const bold = () => BoldFeature;
export const bulletList = () => BulletListFeature;
export const heading = (...levels: Level[]) => HeadingFeature(...levels);
export const hr = () => HorizontalRuleFeature;
export const link = (options?: Parameters<typeof LinkFeature>[0]) => LinkFeature(options);
export const paragraph = () => ParagraphFeature;
export const orderedList = () => OrderedListFeature;
export const blockquote = () => BlockquoteFeature;
export const italic = () => ItalicFeature;
export const upload = (args: Parameters<typeof UploadFeature>[0]) => UploadFeature(args);
export const resource = (args: Parameters<typeof ResourceFeature>[0]) => ResourceFeature(args);

export { NodeViewWrapper, RenderRichText, richTextJSONToText, SvelteNodeViewRenderer };
//
export type { RichTextNodeRenderer, RichTextNodeRendererProps, RichTextResource };
