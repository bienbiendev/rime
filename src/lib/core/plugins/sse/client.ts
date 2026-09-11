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
  connection.handlers.add(handler);

  return () => {
    connection.handlers.delete(handler);
    if (connection.handlers.size === 0) {
      connection.source.close();
      shared.delete(connection.keys);
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
    for (const handler of connection.handlers) void handler(event);
  };

  shared.set(id, connection);
  return connection;
};
