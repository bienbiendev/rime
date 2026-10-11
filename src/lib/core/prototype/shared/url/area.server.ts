import type { BuiltArea } from '#lib/core/config/types.js';
import type { AreaSlug } from '#lib/core/prototype/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { formatUrl } from './format.server.js';
import { addressLocales } from './locales.server.js';

/**
 * Formats the area's url in every locale from its published document there, adds the row a
 * locale lacks (the area's slug, no parent), and writes the urls in one go. Answers the urls.
 *
 * ```ts
 * // infos: $url: ({ locale }) => `${SITE_URL}/${locale}/about`
 * await refreshAreaUrls({ event, config }); // [{ ownerId, locale: 'fr', url: '…/fr/about' }, { …, locale: 'en' }]
 * ```
 */
export const refreshAreaUrls = async (args: { event: RequestEvent; config: BuiltArea }) => {
  const { event, config } = args;
  const { rime } = event.locals;
  const { paths } = rime.adapter;
  const area = rime.area(config.slug as AreaSlug).system();

  const rows = [];
  for (const locale of addressLocales(event)) {
    const doc = await area.find({ locale: locale || undefined });
    const [stored] = await paths.get({ slug: config.slug, ownerId: doc.id, locale });
    if (!stored) {
      await paths.insert({
        slug: config.slug,
        ownerId: doc.id,
        parentId: null,
        rows: [{ locale, slug: config.slug }]
      });
    }
    rows.push({ ownerId: doc.id, locale, url: formatUrl({ config, doc, path: '', locale }) });
  }
  await paths.setUrls({ slug: config.slug, rows });
  return rows;
};
