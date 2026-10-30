import { error, redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { panelAuthImage } from '../image.server.js';

/**
 * 404 without a mailer. A link with no query goes to the site root, one without `?token` is a 400.
 */
export const resetPasswordLoad = async ({ locals, url }: ServerLoadEvent) => {
  const hasParams = url.searchParams.toString() !== '';

  if (!('mailer' in locals.rime)) {
    return error(404);
  }

  if (!hasParams) {
    throw redirect(302, '/');
  }

  const token = url.searchParams.get('token');

  if (!token) {
    throw error(400, 'invalid link');
  }

  return {
    image: panelAuthImage()
  };
};
