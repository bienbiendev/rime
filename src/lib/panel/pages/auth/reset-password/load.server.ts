import { error, redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const resetPasswordLoad = async ({ locals, url }: ServerLoadEvent) => {
  const hasParams = url.searchParams.toString() !== '';

  if (!('mailer' in locals.rime)) {
    return error(404);
  }

  if (!hasParams) {
    throw redirect(302, '/');
  }

  const imageExist = existsSync(path.join(process.cwd(), 'static', 'panel.jpg'));
  const token = url.searchParams.get('token');

  if (!token) {
    throw error(400, 'invalid link');
  }

  return {
    image: imageExist ? '/panel/panel.jpg' : null,
    token: token
  };
};
