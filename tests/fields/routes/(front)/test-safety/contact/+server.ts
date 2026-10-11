import type { RequestHandler } from './$types';

// An app's own endpoint: creates a contact as rime, whoever asks, and answers what it got back
export const POST: RequestHandler = async ({ locals, request }) => {
  const doc = await locals.rime
    .collection('contacts')
    .system()
    .create({ data: await request.json() });
  return Response.json({ doc });
};
