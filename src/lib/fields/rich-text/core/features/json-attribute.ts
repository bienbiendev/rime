import type { Attribute } from '@tiptap/core';

/**
 * A node attribute that holds an object. Copy and paste carry nodes through HTML, so the object
 * is written there as JSON and read back from it.
 *
 * ```ts
 * addAttributes() { return { json: jsonAttribute('json') } }
 * // <rich-text-fields-hero json="{&quot;title&quot;:&quot;Hi&quot;}">
 * ```
 */
export const jsonAttribute = (name: string): Attribute => ({
  default: null,
  parseHTML: (element) => {
    const text = element.getAttribute(name);
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  },
  renderHTML: (attributes) => {
    const value = attributes[name];
    if (value == null) return {};
    return { [name]: JSON.stringify(value) };
  }
});
