import type { RequestHandler } from './$types';

// An app's own endpoint: uploads a media as rime, whoever asks
export const POST: RequestHandler = async ({ locals, request }) => {
  const doc = await locals.rime
    .collection('privateMedias')
    .system()
    .create({ data: await request.json() });
  return Response.json({ doc });
};

// An app's own endpoint: deletes a media as rime, whoever asks
export const DELETE: RequestHandler = async ({ locals, url }) => {
  const id = url.searchParams.get('id') || '';
  await locals.rime.collection('privateMedias').system().deleteById({ id });
  return Response.json({ id });
};
