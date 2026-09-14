/**
 * The event stream, client half. The server half is `index.server.ts`.
 *
 * - The client calls `openSse` with the keys it wants, which opens `GET /api/sse?keys=…`.
 * - The server answers it in `connect`: it checks each key, then leaves the response open.
 * - The server sends an event with `emit`, which writes it to the connections holding that key.
 * - The client's handler is called with that event.
 */
export { openSse } from './client.js';
export type { SSEAccess, SSEEvent, SSEHandler } from './types.js';
