import { RimeError } from '#lib/core/errors/index.js';
import type { DataType } from '#lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '#lib/fields/types.js';
import { isObjectLiteral } from '#lib/util/object.js';
import { duplicateRichText, populateReferences } from '$rime/modules:fields/rich-text';
import type { JSONContent } from '@tiptap/core';
import Cell from './component/Cell.svelte';
import RichText from './component/RichText.svelte';
import type { RichTextFeature } from './core/types.js';
import { isJSONContent } from './json.js';
import { sanitizeJSONContent } from './sanitize.js';
import { storedReferences } from './reference-nodes.js';

// Blocks that only hold text: empty when they hold none
const TEXT_BLOCKS = new Set(['doc', 'paragraph', 'heading', 'hardBreak']);

// A node holds content when it has text, or is a leaf such as an image or a rule
const hasContent = (node: JSONContent): boolean => {
  if (node.type === 'text') return !!node.text?.trim();
  if (node.content?.length) return node.content.some(hasContent);
  return !TEXT_BLOCKS.has(node.type ?? '');
};

// The document a string holds, or null when the string is not a JSON document
const parseDocument = (value: string): JSONContent | null => {
  try {
    const parsed = JSON.parse(value);
    return isJSONContent(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Whether a rich text holds nothing: no text and no leaf, as a document or as the JSON string
 * the server stores. A plain string is empty when it is blank.
 *
 * ```ts
 * isEmpty({ type: 'doc', content: [{ type: 'paragraph' }] });                     // true
 * isEmpty('{"type":"doc","content":[{"type":"paragraph"}]}');                      // true
 * isEmpty({ type: 'doc', content: [{ type: 'image', attrs: { src: 'a.png' } }] }); // false
 * isEmpty('Hello');                                                                // false
 * ```
 */
const isEmpty = (value: unknown): boolean => {
  if (typeof value === 'string') {
    const document = parseDocument(value);
    return document ? !hasContent(document) : value.trim() === '';
  }
  return !isJSONContent(value) || !hasContent(value);
};

export class RichTextFieldBuilder extends FormFieldBuilder<RichTextField> {
  constructor(name: string) {
    super(name, 'richText');
    this.field.isEmpty = isEmpty;
    this.field.hooks = {
      beforeRead: [RichTextFieldBuilder.jsonParse, populateReferences],
      beforeSave: [
        RichTextFieldBuilder.sanitize,
        RichTextFieldBuilder.storeReferences,
        RichTextFieldBuilder.stringify
      ],
      beforeValidate: [],
      beforeDuplicate: [duplicateRichText]
    };
  }

  get component() {
    return RichText;
  }

  get cell() {
    return Cell;
  }

  isTitle() {
    this.field.isTitle = true;
    return this;
  }

  /**
   * The editor's features, from `rimecms/fields/rich-text`. Two features that make the same
   * node type, such as two `upload()` of one collection, are refused.
   *
   * ```ts
   * richText('intro').features(bold(), heading(2, 3), link());
   * ```
   */
  features(...features: Array<RichTextFeature>) {
    const names = features.flatMap((feature) => feature.extension?.name ?? []);
    const repeated = names.find((name, index) => names.indexOf(name) !== index);
    if (repeated) {
      throw new RimeError(
        RimeError.CONFIG_ERROR,
        `richText('${this.name}'): two features make the node type ${repeated}`
      );
    }
    this.field.features = features;
    return this;
  }

  /**
   * A stored value back to rich text: a JSON string is parsed, a document or a plain string
   * comes back as it is.
   */
  static readonly jsonParse = (value: unknown) => {
    if (typeof value !== 'string') return value;
    try {
      // A text node's text comes back as a string, also one stored as a number
      const parsed = JSON.parse(value, function (key, val) {
        return key === 'text' && this.type === 'text' && val != null ? String(val) : val;
      });
      return isObjectLiteral(parsed) ? parsed : value;
    } catch {
      return value;
    }
  };

  /**
   * Removes the script `href`s of a document, also of one sent as a JSON string. A plain string
   * holds no link and stays as it is.
   */
  static readonly sanitize = (value: unknown) => {
    const document = RichTextFieldBuilder.jsonParse(value);
    return isJSONContent(document) ? sanitizeJSONContent(document) : value;
  };

  /**
   * A node naming a document is stored as what names it, an upload's `legend` too: a read fills
   * the rest.
   */
  static readonly storeReferences = (value: unknown) =>
    isJSONContent(value) ? storedReferences(value) : value;

  static readonly stringify = (value: string) => {
    if (typeof value === 'string') return value;
    try {
      value = JSON.stringify(value);
    } catch (err: any) {
      console.error(err.message);
    }
    return value;
  };

  get dataType(): DataType {
    return 'json';
  }

  protected override generateType(): string {
    return `${this.name}${this.get.required ? '' : '?'}: import('@tiptap/core').JSONContent`;
  }
}

export const richText = (name: string) => new RichTextFieldBuilder(name);

type RichTextContent = { type: 'doc'; content: JSONContent[] };

export type RichTextField = FormField & {
  type: 'richText';
  isTitle?: true;
  features?: Array<RichTextFeature>;
  defaultValue?: RichTextContent | DefaultValueFn<RichTextContent>;
};
