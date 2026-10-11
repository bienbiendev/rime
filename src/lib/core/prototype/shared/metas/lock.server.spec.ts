import { describe, expect, it, vi } from 'vitest';
import { moveEditLock } from './lock.server.js';

describe('moveEditLock', () => {
  it('tells the other tabs once', async () => {
    const emit = vi.fn();
    const updateWhere = vi.fn(async () => true);
    const event = {
      locals: { rime: { adapter: { contentOwner: () => ({ updateWhere }) }, sse: { emit } } }
    } as any;
    const doc = { id: 'p1', currentlyEditedBy: 'u1', currentlyEditedAt: new Date() };

    const moved = await moveEditLock({
      event,
      config: { slug: 'pages' } as any,
      doc,
      to: { id: 'p1' },
      userId: 'u1'
    });

    expect(moved).toBe(true);
    expect(updateWhere).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
