import type { RequestHandler } from './$types';

// An endpoint answering with its own cache-control: the cache plugin leaves it as it is
export const GET: RequestHandler = () =>
  new Response('endpoint', { headers: { 'cache-control': 'no-store' } });
