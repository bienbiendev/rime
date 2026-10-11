import type { SSEEvent, SSEHandler } from './types.js';

/**
 * Listen to the key, or keys, you name. Returns the unsubscribe.
 *
 * The keys go in the request, so the server decides once whether you may hear them and then
 * sends you only those — nothing arrives that you did not ask for.
 *
 * Callers naming the same keys share one connection: a browser allows only a handful per origin,
 * and the panel has a listener per open document. It opens on the first caller and closes when
 * the last one leaves.
 *
 * @example
 * $effect(() => openSse(`rime:pages:${id}`, ({ event }) => {
 *   if (event === 'rime:lock') invalidateAll();
 * }));
 */
export const openSse = (keys: string | string[], handler: SSEHandler): (() => void) => {
  const connection = connect(keys);
  // One entry per call: the same handler passed twice is two listeners
  const listener: SSEHandler = (event) => handler(event);
  connection.handlers.add(listener);

  // Runs once: a second call would close a newer stream opened on the same keys
  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    connection.handlers.delete(listener);
    if (connection.handlers.size === 0) {
      connection.source.close();
      if (shared.get(connection.keys) === connection) shared.delete(connection.keys);
    }
  };
};

/** One open stream, everyone listening on it, and the keys it was opened for. */
type Connection = { source: EventSource; handlers: Set<SSEHandler>; keys: string };

/** One entry per distinct set of keys — a different set is a different URL, so a new stream. */
const shared = new Map<string, Connection>();

const connect = (keys: string | string[]): Connection => {
  // Sorted, so two callers naming the same keys in a different order share one stream.
  const id = [...new Set(typeof keys === 'string' ? [keys] : keys)].sort().join(',');
  const existing = shared.get(id);
  if (existing) return existing;

  const source = new EventSource(`/api/sse?keys=${encodeURIComponent(id)}`);
  const connection: Connection = { source, handlers: new Set(), keys: id };

  source.onerror = (error) => console.error('[sse] connection error', error);

  source.onmessage = (message) => {
    let event: SSEEvent;
    try {
      event = JSON.parse(message.data);
    } catch (error) {
      return console.error('[sse] unreadable event', error, message.data);
    }
    // A listener that fails, at once or later, is logged; the others still hear the event
    const failed = (error: unknown) => console.error('[sse] listener failed', error);
    for (const handler of connection.handlers) {
      try {
        void Promise.resolve(handler(event)).catch(failed);
      } catch (error) {
        failed(error);
      }
    }
  };

  shared.set(id, connection);
  return connection;
};
