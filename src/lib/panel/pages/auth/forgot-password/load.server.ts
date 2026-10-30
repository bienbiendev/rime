import { error, redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { panelAuthImage } from '../image.server.js';

/** 404 without a mailer; a signed-in visitor goes to the site root. */
export const forgotPasswordLoad = async ({ locals }: ServerLoadEvent) => {
  const { session, rime } = locals;
  if (!('mailer' in rime)) {
    return error(404);
  }

  if (session) {
    throw redirect(302, '/');
  } else {
    return {
      image: panelAuthImage()
    };
  }
};
