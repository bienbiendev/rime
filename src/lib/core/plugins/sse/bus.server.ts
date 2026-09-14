import { error, type RequestHandler } from '@sveltejs/kit';
import type { SSEAccess } from './types.js';

/**
 * The connected clients, and what each of them asked to hear about.
 *
 * A client names its keys when it connects, so an event goes only to the connections that want
 * it — and access is decided once, up front, rather than trusting every listener with
 * everything. In memory, so an event reaches the clients this process is serving and no further.
 */

type Client = { writer: WritableStreamDefaultWriter<string>; keys: Set<string> };

const clients = new Set<Client>();

/** Long enough to be cheap, short enough to beat the usual proxy idle timeout. */
const KEEP_ALIVE_MS = 30_000;

/**
 * Sends one event to every client listening on `key`.
 *
 * @example
 * rime.sse.emit(`rime:pages:42`, 'rime:lock');
 */
export const emit = (key: string, event: string, payload: Record<string, any> = {}): void => {
  // The name travels in the data, not in an `event:` field. A named frame only reaches a client
  // that asked for that name, which would mean every listener knowing the names up front.
  const frame = `data: ${JSON.stringify({ event, payload })}\n\n`;

  for (const client of clients) {
    if (!client.keys.has(key)) continue;
    void client.writer.write(frame).catch(() => clients.delete(client));
  }
};

/**
 * `GET /api/sse?keys=a,b` — the connection every event is written down.
 *
 * Refuses the whole connection if `access` turns down any key it names: a caller who may hear
 * about one thing and not another opens two connections and finds out which.
 */
export const connect = (access: SSEAccess): RequestHandler => {
  /**
   * `rime:` is the panel's own and always needs staff — not negotiable, so `access` never sees
   * those keys. Every other key is the app's to open.
   */
  const allowed: SSEAccess = (key, user) =>
    key.startsWith('rime:') ? !!user?.isStaff : access(key, user);

  return ({ request, url, locals }) => {
    const keys = new Set((url.searchParams.get('keys') ?? '').split(',').filter(Boolean));
    if (!keys.size) error(400, 'no keys');

    for (const key of keys) {
      // 403, not 404: the caller has a session, it just does not reach this key.
      if (!allowed(key, locals.user)) error(403);
    }

    const { readable, writable } = new TransformStream<string, string>();
    const writer = writable.getWriter();
    const client: Client = { writer, keys };
    clients.add(client);

    // A comment frame, so the client's `onopen` fires before the first real event.
    // Every write and the close are caught: a client that goes away mid-write rejects, and an
    // uncaught one takes the process down rather than just dropping that client.
    void writer.write(`: open ${new Date().toISOString()}\n\n`).catch(leave);

    const keepAlive = setInterval(() => {
      void writer.write(`: keep-alive\n\n`).catch(leave);
    }, KEEP_ALIVE_MS);

    function leave() {
      clearInterval(keepAlive);
      clients.delete(client);
    }

    request.signal.addEventListener('abort', () => {
      leave();
      void writer.close().catch(() => {});
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    });
  };
};
