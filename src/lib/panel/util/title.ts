import { t__ } from '#lib/core/i18n/index.js';
import { isJSONContent, RichText } from '#lib/fields/rich-text/json.js';

/** A document's label in the panel: its title, or "Untitled" in the panel language. */
export const titleOrUntitled = (title?: string | null) => title || t__('common.untitled');

/**
 * The text of a title value: a string as is, rich text as its plain text, anything else empty.
 *
 * ```ts
 * titleText('About') // 'About'
 * titleText({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'About' }] }] }) // 'About'
 * titleText(new Date()) // ''
 * ```
 */
export const titleText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  return isJSONContent(value) ? RichText.toText(value) : '';
};
