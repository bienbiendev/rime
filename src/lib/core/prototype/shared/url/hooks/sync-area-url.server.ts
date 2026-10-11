import type { BuiltArea } from '#lib/core/config/types.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { refreshAreaUrls } from '../area.server.js';

/**
 * After a save, the area's url in every locale, since `$url` may read any of its fields. The
 * document answered carries the url of its locale. An auto-save changes no url: it is skipped.
 */
export const syncAreaUrl = Hooks.afterUpdate<'generic'>(async function syncAreaUrl(args) {
  const { event, doc, context } = args;
  if (context.params.autoSave) return args;
  const rows = await refreshAreaUrls({ event, config: args.config as BuiltArea });
  const locale = (doc.locale as string | undefined) ?? '';
  const url = rows.find((row) => row.locale === locale)?.url ?? null;
  return { ...args, doc: { ...doc, url } };
});
