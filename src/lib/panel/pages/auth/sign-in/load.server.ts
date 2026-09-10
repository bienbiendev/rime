import { PANEL_AUTH_IMAGE } from '$lib/core/constants.server.js';
import { redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const signInLoad = async ({ locals, params }: ServerLoadEvent) => {
  const { session, rime } = locals;

  const imageExist = existsSync(path.join(process.cwd(), 'static', PANEL_AUTH_IMAGE));

  if (session) {
    throw redirect(302, `/${params.panel}`);
  } else {
    return {
      forgotPasswordEnabled: 'mailer' in rime,
      image: imageExist ? PANEL_AUTH_IMAGE : null,
      form: {}
    };
  }
};
