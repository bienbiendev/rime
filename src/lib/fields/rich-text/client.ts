import type { JSONContent } from '@tiptap/core';
import type { Level } from '@tiptap/extension-heading';
import { BlockquoteFeature } from './core/features/blockquote.js';
import { BoldFeature } from './core/features/bold.js';
import { BulletListFeature } from './core/features/bullet-list.js';
import { FieldsFeature, type FieldsFeatureOptions } from './core/features/fields/index.js';
import { HeadingFeature } from './core/features/heading.js';
import { HorizontalRuleFeature } from './core/features/hr/hr.js';
import { ItalicFeature } from './core/features/italic.js';
import { LinkFeature, type LinkFeatureOptions } from './core/features/link/index.js';
import { OrderedListFeature } from './core/features/ordered-list.js';
import { ParagraphFeature } from './core/features/paragraph.js';
import { ResourceFeature } from './core/features/resource/index.js';
import type { ResourceFeatureExtensionOptions } from './core/features/resource/resource-extension.js';
import type { RichTextResource } from './core/features/resource/types.js';
import { UploadFeature } from './core/features/upload/index.js';
import type { UploadFeatureExtensionOptions } from './core/features/upload/upload-extension.js';
import SvelteNodeViewRenderer from './core/svelte/node-view-renderer.svelte';
import NodeViewWrapper from './core/svelte/node-view-wrapper.svelte';

/**
 * A block of fields inside the text, edited in a sheet. `name` becomes the stored node type
 * `rich-text-fields-<name>`: renaming it leaves the stored nodes without a feature.
 *
 * ```ts
 * fields({ name: 'cta', label: 'Call to action', fields: [text('label'), text('url')] })
 * ```
 */
export const fields = (args: FieldsFeatureOptions) => FieldsFeature(args);
export const bold = () => BoldFeature;
export const bulletList = () => BulletListFeature;
/** Headings of the levels given, or of all six when none is given. */
export const heading = (...levels: Level[]) => HeadingFeature(...levels);
export const hr = () => HorizontalRuleFeature;
/**
 * Links, set from the bubble menu. `sources` lists the collections or areas whose documents the
 * link form offers, each `<slug>` or `<slug>?<query>`; every other option is tiptap Link's.
 *
 * ```ts
 * link({ sources: ['pages', 'news?where[status][equals]=published'] })
 * ```
 */
export const link = (options?: Partial<LinkFeatureOptions>) => LinkFeature(options);
export const paragraph = () => ParagraphFeature;
export const orderedList = () => OrderedListFeature;
export const blockquote = () => BlockquoteFeature;
export const italic = () => ItalicFeature;
/**
 * A media from an upload collection, picked from the palette. `source` is the collection slug,
 * with an optional query that filters the picker: `'medias?where[mimeType][like]=image'`. The
 * node type is `rich-text-upload-<slug>`.
 */
export const upload = (args: UploadFeatureExtensionOptions) => UploadFeature(args);
/**
 * A document of a collection, picked from the palette. `source` is `<slug>` or
 * `<slug>?<query>`; the node type is `rich-text-resource-<slug>`.
 */
export const resource = (args: ResourceFeatureExtensionOptions) => ResourceFeature(args);

export { NodeViewWrapper, SvelteNodeViewRenderer };
export type { JSONContent, RichTextResource };
