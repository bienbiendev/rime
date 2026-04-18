import { error, redirect } from '@sveltejs/kit';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PrototypeSlug } from '$lib/core/types/doc.js';
import { PARAMS } from '$lib/core/constant.js';

export async function liveLoad(event: ServerLoadEvent) {
  const { user, rime } = event.locals;
  event.depends('data:src');
  const params = event.url.searchParams;

  const id = params.get('id');
  const versionId = params.get(PARAMS.VERSION_ID) || undefined;
  const locale = params.get(PARAMS.LOCALE) || undefined;
  const slug = params.get('slug') as PrototypeSlug;
  const src = params.get('src');

  if (!user) {
    error(404, 'Not found');
  }
  if (user && src && slug && id) {
    const output = { user, src: src, slug, locale };

    if (rime.config.isCollection(slug)) {
      const doc = await rime.collection(slug).findById({ id, locale, versionId });
      return { ...output, doc };
    } else {
      const doc = await rime.area(slug).find({ locale, versionId });
      return { ...output, doc };
    }
  } else {
    redirect(302, '/');
  }
}
