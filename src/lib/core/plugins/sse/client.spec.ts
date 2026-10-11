import { afterEach, describe, expect, test, vi } from 'vitest';

/** A stand-in for the browser's EventSource: records closes, lets the test send a message. */
class FakeEventSource {
  static last: FakeEventSource;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: unknown = null;
  close = vi.fn();
  constructor(public url: string) {
    FakeEventSource.last = this;
  }
}

vi.stubGlobal('EventSource', FakeEventSource);
const { openSse } = await import('./client.js');

afterEach(() => vi.clearAllMocks());

describe('openSse', () => {
  test('the same handler subscribed twice keeps listening after one unsubscribe', () => {
    const handler = vi.fn();
    const first = openSse('k', handler);
    openSse('k', handler);
    first();

    FakeEventSource.last.onmessage!({ data: JSON.stringify({ event: 'ping' }) });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(FakeEventSource.last.close).not.toHaveBeenCalled();
  });

  test('an unsubscribe called twice leaves a newer stream on the same keys open', () => {
    const first = openSse('twice', vi.fn());
    first();
    const older = FakeEventSource.last;

    openSse('twice', vi.fn());
    const newer = FakeEventSource.last;
    first();

    expect(newer).not.toBe(older);
    expect(newer.close).not.toHaveBeenCalled();
    openSse('twice', vi.fn());
    expect(FakeEventSource.last).toBe(newer);
  });

  test('a handler that throws leaves the others to hear the event', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    const stop = [
      openSse('throws', () => {
        throw new Error('broken');
      }),
      openSse('throws', after)
    ];

    FakeEventSource.last.onmessage!({ data: JSON.stringify({ event: 'ping' }) });
    await new Promise((resolve) => setTimeout(resolve));

    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('[sse] listener failed', expect.any(Error));
    stop.forEach((unsubscribe) => unsubscribe());
    error.mockRestore();
  });
});
