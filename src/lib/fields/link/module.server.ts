import { findTitleField } from '#lib/core/prototype/shared/title/find-title.js';
import { selectWithTitle } from '#lib/core/prototype/shared/title/select.js';
import type { AreaSlug, CollectionSlug } from '#lib/types.js';
import { trycatch } from '#lib/util/function.js';
import { omit } from '#lib/util/object.js';
import type { FieldHook, LinkField } from '../types.js';
import type { Link } from './types.js';
import { isDocumentLink } from './util.js';

/** What a read puts on a document link, and what it takes off when the target gives nothing. */
const TARGET_KEYS: (keyof Link)[] = ['id', 'url', 'title'];

/**
 * A link to a document carries its target's `id`, `url` and `title`, read in the read's own
 * locale with only those selected. A target this reader may not read, or with no url, leaves the
 * link with none of them. Any other link is returned as stored.
 *
 * ```ts
 * // { type: 'pages', value: 'p2', target: '_self' }
 * //   -> { type: 'pages', value: 'p2', target: '_self', id: 'p2', url: 'https://site.test/about', title: 'About' }
 * ```
 *
 * The read selects no link, so it reads no target of its own.
 */
export const populateRessourceURL: FieldHook<LinkField> = async (
  link: Link,
  { event, operation }
) => {
  if (!isDocumentLink(link)) return link;

  const { rime } = event.locals;
  const isArea = rime.config.isArea(link.type);
  // A type no config names any more: nothing to read
  if (!isArea && !rime.config.isCollection(link.type)) return omit(TARGET_KEYS, link);

  const system = !!operation.isSystemOperation;
  // The read's own locale: `find({ locale: 'en' })` gives its links their `en` url.
  const locale = operation.params.locale ?? event.locals.locale;
  const config = rime.config.getBySlug(link.type);
  const select = selectWithTitle('url,title', config.asTitle);

  const [, doc] = await trycatch(() =>
    isArea
      ? rime
          .area(link.type as AreaSlug)
          .system(system)
          .find({ locale, select })
      : rime
          .collection(link.type as CollectionSlug)
          .system(system)
          .findById({ id: link.value, locale, select })
  );

  if (!doc?.url) return omit(TARGET_KEYS, link);
  // An area with no title field is named by its label rather than its id.
  const title = config.type === 'area' && !findTitleField(config.fields) ? config.label : doc.title;
  return { ...link, id: doc.id, url: doc.url, title };
};
