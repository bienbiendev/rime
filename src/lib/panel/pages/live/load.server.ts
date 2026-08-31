import { env } from '$env/dynamic/public';
import { PARAMS } from '$lib/core/constants.js';
import type { PrototypeSlug } from '$lib/core/types/doc.js';
import type { ServerLoadEvent } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';

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

  // Validate src is from the trusted frontend origin to prevent iframe injection
  if (src) {
    try {
      const trustedOrigin = new URL(env.PUBLIC_RIME_URL).origin;
      if (new URL(src).origin !== trustedOrigin) {
        error(400, 'Invalid src');
      }
    } catch {
      error(400, 'Invalid src');
    }
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
