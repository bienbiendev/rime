import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { isJSONContent, RichText } from '#lib/fields/rich-text/json.js';
import { getValueAtPath } from '#lib/util/object.js';

/**
 * A title field's value as text: rich text as its words, a date as its day, a string as it is.
 * Anything else, or nothing, gives `null`, and the document is titled with its id.
 *
 * ```ts
 * titleText(new Date('2026-11-03T00:00:00Z')) // '2026-11-03'
 * titleText({ type: 'doc', content: [...] })   // 'Rethink it'
 * titleText(null)                               // null
 * ```
 */
const titleText = (value: unknown): string | null => {
  if (isJSONContent(value)) return RichText.toText(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value;
  return null;
};

/**
 * Puts `title` on the document, read from whichever field `asTitle` resolved to.
 */
export const setDocumentTitle = Hooks.beforeRead(async function setDocumentTitle(args) {
  const config = args.config;
  let doc = args.doc;

  const paramSelect = args.context.params.select;
  const hasSelect = Array.isArray(paramSelect) && paramSelect.length;
  const shouldSetTitle = !doc.title && (!hasSelect || (hasSelect && paramSelect.includes('title')));

  if (shouldSetTitle) {
    const title = titleText(getValueAtPath(config.asTitle, doc)) || doc.id;
    doc = { title, ...doc };
  }

  return { ...args, doc };
});
