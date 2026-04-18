import { error, type RequestHandler } from '@sveltejs/kit';
import { definePlugin, type Plugin } from '../index.js';
import { broadcast, registerWriter } from './broadcast.js';

export const sse = definePlugin(() => {
  const requestHandler: RequestHandler = async ({ request, locals }) => {
    if (!locals.user || !locals.user.isStaff) return error(404);

    try {
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      const unregister = registerWriter(writer);

      // Open the stream immediately
      writer.write(`: connected ${new Date().toISOString()}\n\n`);

      // Keep-alive ping to prevent timeouts
      const keepAlive = setInterval(() => {
        writer.write(`: keep-alive ${Date.now()}\n\n`).catch(() => {
          clearInterval(keepAlive);
          unregister();
        });
      }, 30000);

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        console.log('[SSE] Client disconnected');
        clearInterval(keepAlive);
        unregister();
        writer.close();
      });

      return new Response(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        }
      });
    } catch (error) {
      console.error('[SSE] Error in GET handler:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  };

  return {
    name: 'sse',
    type: 'server',
    actions: {
      broadcast
    },
    routes: {
      '/api/sse': {
        GET: requestHandler
      }
    }
  } as const satisfies Plugin;
});

export type SSEActions = {
  broadcast: typeof broadcast;
};
