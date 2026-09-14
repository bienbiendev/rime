import { prototypeKebab } from '$lib/core/prototype/naming.js';
import { withVersionsSuffix } from '$lib/core/prototype/shared/versions/naming.js';
import { apiUrl } from '$lib/core/routes/util.js';

/** The versions collection's endpoint behind a document type: `/api/news--versions`. */
export const versionsApiUrl = (type: string) => apiUrl(prototypeKebab(withVersionsSuffix(type)));

/**
 * One document's history, as the sidebar and the settings menu read it. One URL, so the API
 * proxy serves both from the same cache and one invalidation refreshes both.
 */
export const versionsListUrl = (doc: { _type: string; id: string }) =>
  `${versionsApiUrl(doc._type)}?where[ownerId][equals]=${doc.id}&sort=-updatedAt&select=updatedAt,status,isAutoSave,updatedBy`;
