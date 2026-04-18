import { redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const signInLoad = async ({ locals }: ServerLoadEvent) => {
  const { session, rime } = locals;

  const imageExist = existsSync(path.join(process.cwd(), 'static', 'panel', 'panel.jpg'));

  if (session) {
    throw redirect(302, '/panel');
  } else {
    return {
      forgotPasswordEnabled: 'mailer' in rime,
      image: imageExist ? '/panel/panel.jpg' : null,
      form: {}
    };
  }
};
