import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '$lib/fields/types.js';
import { sanitize } from '$lib/util/string.js';
import type { JSONContent } from '@tiptap/core';
import Cell from './component/Cell.svelte';
import RichText from './component/RichText.svelte';
import type { RichTextFeature } from './core/types.js';
import { sanitizeJSONContent } from './sanitize';

const isEmpty = (value: unknown) => {
	if (!value) return true;
	// Check for content length in pm object
	if (typeof value === 'object' && !Array.isArray(value) && 'content' in value) {
		return Array.isArray(value.content) && value.content.length === 0;
	}
	// Allow simple string
	if (typeof value === 'string' && !!value) return false;
	return true;
};

export class RichTextFieldBuilder extends FormFieldBuilder<RichTextField> {
	//
	_metaUrl = import.meta.url;

	constructor(name: string) {
		super(name, 'richText');
		this.field.isEmpty = isEmpty;
		this.field.hooks = {
			beforeRead: [RichTextFieldBuilder.jsonParse],
			beforeSave: [RichTextFieldBuilder.sanitize, RichTextFieldBuilder.stringify],
			beforeValidate: []
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
	 * Sets a custom TipTap editor configuration for the rich text field.
	 *
	 * @param param - a feature name, a RichTextFeature object, or a shortcut config string
	 *
	 * @example
	 * // Using predefined features
	 * richText('intro').features('bold', 'heading', 'link')
	 *
	 * // Using custom features
	 * richText('intro').features(myCustomFeature)
	 *
	 */
	features(...features: Array<RichTextFeature>) {
		this.field.features = features;
		return this;
	}

	static readonly jsonParse = (value: string) => {
		try {
			value = JSON.parse(value, (key, val) => {
				if (key === 'text') return String(val);
				return val;
			});
		} catch (err) {
			console.log(err);
			if (typeof value === 'string') {
				return value;
			}
			return '';
		}
		return value;
	};

	static readonly sanitize = (value: unknown) => {
		if (!value) return value;
		// Handle string input - just sanitize as plain text
		if (typeof value === 'string') {
			return sanitize(value);
		}
		// Handle JSONContent object
		if (typeof value === 'object' && value !== null && 'content' in value) {
			return sanitizeJSONContent(value as JSONContent);
		}
		return value;
	};

	static readonly stringify = (value: string) => {
		if (typeof value === 'string') return value;
		try {
			value = JSON.stringify(value);
		} catch (err: any) {
			console.error(err.message);
		}
		return value;
	};

	defaultValue(value: RichTextContent | DefaultValueFn<RichTextContent>) {
		this.field.defaultValue = value;
		return this;
	}
}

export const richText = (name: string) => new RichTextFieldBuilder(name);

/**
 * Converts rich text JSON content to plain text.
 * Extracts text content from a TipTap/ProseMirror JSON structure.
 *
 * @example
 * // Returns "Hello world"
 * richTextJSONToText('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello world"}]}]}');
 */
export const richTextJSONToText = (value: string | JSONContent): string => {
	if (!value) return '';
	let textValue: string;
	const renderNodes = (nodes: { [k: string]: any }) => {
		return nodes
			.map((node: { text?: string; [k: string]: any }) => {
				if ('text' in node) {
					return node.text;
				} else if ('content' in node) {
					return renderNodes(node.content);
				}
			})
			.join(' ');
	};

	try {
		const jsonContent = typeof value === 'string' ? JSON.parse(value) : value;
		textValue = renderNodes(jsonContent.content);
	} catch (err) {
		console.error(err);
		textValue = JSON.stringify(value);
	}
	return textValue;
};

type RichTextContent = { type: 'doc'; content: JSONContent[] };

export type RichTextField = FormField & {
	type: 'richText';
	isTitle?: true;
	features?: Array<RichTextFeature>;
	defaultValue?: RichTextContent | DefaultValueFn<RichTextContent>;
};
