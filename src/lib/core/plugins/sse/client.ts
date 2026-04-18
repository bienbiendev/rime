import type { ContentUpdatePayload } from './types.js';

export type SSEEvent = {
  type: string;
  details: ContentUpdatePayload;
};

type SSEHandler = (event: SSEEvent) => void | Promise<void>;

/**
 * Opens an SSE connection with a single event handler.
 * @example
 * const close = openSse(async (evt) => {
 *   if (evt.type === 'rime:update') {
 *     if (evt.details.documentType === 'pages') {
 *       await invalidateAll();
 *     }
 *   }
 * });
 */
export const openSse = (handler: SSEHandler): (() => void) => {
  const es = new EventSource('/api/sse');

  console.log('[SSE] init client');

  // Handle custom events (rime:*)
  const handleCustomEvent = async (evt: MessageEvent) => {
    console.log('[SSE Client] get custom event', evt.type, evt.data);

    try {
      const details = JSON.parse(evt.data) as ContentUpdatePayload;
      await handler({
        type: evt.type,
        details
      });
    } catch (error) {
      console.error('[SSE Client] Failed to parse event:', error, evt.data);
    }
  };

  // Listen for all rime events
  const eventTypes = ['rime:create', 'rime:update', 'rime:delete'];
  eventTypes.forEach((eventType) => {
    es.addEventListener(eventType, handleCustomEvent);
  });

  es.onopen = () => console.log('[SSE Client] Connection opened');
  es.onerror = (e) => console.error('[SSE Client] Connection error:', e);

  return () => {
    console.log('[SSE Client] Closing connection');
    eventTypes.forEach((eventType) => {
      es.removeEventListener(eventType, handleCustomEvent);
    });
    es.close();
  };
};
