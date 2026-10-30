import { redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { panelAuthImage } from '../image.server.js';

/**
 * Sends a signed-in visitor to the panel; otherwise the form, the forgot-password flag (a mailer
 * is set) and the image.
 */
export const signInLoad = async ({ locals }: ServerLoadEvent) => {
  const { session, rime } = locals;

  if (session) {
    throw redirect(302, `/${rime.routes.panel}`);
  } else {
    return {
      forgotPasswordEnabled: 'mailer' in rime,
      image: panelAuthImage(),
      form: {}
    };
  }
};
