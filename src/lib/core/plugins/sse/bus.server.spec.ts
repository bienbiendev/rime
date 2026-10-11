import { describe, expect, it } from 'vitest';
import { connect, emit } from './bus.server.js';

/** Opens a stream on `key` for a caller every key is open to. */
const open = async (key: string) => {
  const abort = new AbortController();
  const response = await connect(() => true)({
    request: { signal: abort.signal },
    url: new URL(`http://localhost/api/sse?keys=${key}`),
    locals: {}
  } as any);
  return { reader: response!.body!.getReader(), abort };
};

/** One tick of the event loop: long enough for a written frame to be readable. */
const tick = () => new Promise((resolve) => setImmediate(() => resolve('pending')));

/**
 * Reads every frame the stream still hands out, and whether it has ended: closed, or broken off
 * with what it held.
 */
const drain = async (reader: ReadableStreamDefaultReader<unknown>) => {
  let frames = 0;
  for (;;) {
    const read = await Promise.race([reader.read().catch(() => 'broken'), tick()]);
    if (read === 'pending') return { frames, ended: false };
    if (read === 'broken') return { frames, ended: true };
    if ((read as ReadableStreamReadResult<unknown>).done) return { frames, ended: true };
    frames++;
  }
};

describe('the SSE bus', () => {
  it('drops a client that stops reading, instead of queueing every event', async () => {
    const { reader, abort } = await open('slow');
    for (let i = 0; i < 300; i++) emit('slow', 'ping');

    // Ended at once: the frames it never read are dropped with it, not waited for
    const { frames, ended } = await drain(reader);
    expect(ended).toBe(true);
    expect(frames).toBe(0);
    abort.abort();
  });
});
