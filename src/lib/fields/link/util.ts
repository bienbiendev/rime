import { isObjectLiteral } from '#lib/util/object.js';
import type { Link } from './types.js';

/** The link types whose `value` is the address itself. */
const PLAIN_TYPES = ['url', 'email', 'tel', 'anchor'];

/**
 * A link whose `type` names a collection or an area, and whose `value` is a document id.
 *
 * ```ts
 * isDocumentLink({ type: 'pages', value: 'p1', target: '_self' }); // true
 * isDocumentLink({ type: 'url', value: 'https://a.test', target: '_self' }); // false
 * ```
 */
export const isDocumentLink = (link: unknown): link is Link & { value: string } =>
  isObjectLiteral(link) &&
  typeof link.type === 'string' &&
  !PLAIN_TYPES.includes(link.type) &&
  typeof link.value === 'string' &&
  !!link.value;
