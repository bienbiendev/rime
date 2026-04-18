import { RimeError } from '$lib/core/errors/index.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import { error, json, type RequestEvent } from '@sveltejs/kit';

export default function (slug: string) {
  //
  async function POST(event: RequestEvent) {
    const { rime } = event.locals;

    if (!rime.config.isCollection(slug)) {
      return handleError(new RimeError(RimeError.NOT_FOUND), { context: 'api' });
    }
    const collection = rime.collection(slug);
    if (!event.params.id) throw error(404);

    const newId = await collection.duplicate({ id: event.params.id });

    return json({ id: newId });
  }

  return POST;
}
