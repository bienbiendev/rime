import { describe, expect, it, vi } from 'vitest';
import { restLock as restLockArea } from '../../area/rest/lock.server.js';
import { restLock } from './lock.server.js';

vi.mock('#lib/core/prototype/shared/metas/lock-answer.server.js', () => ({
  answerLock: async () => new Response('{}')
}));

/** A staff claim on `pages/p1` or the `settings` area, whose update rule records what it is asked. */
const setup = () => {
  const update = vi.fn(() => true);
  const config = { access: { update } };
  const system = () => ({ findById: async () => ({ id: 'p1' }), find: async () => ({ id: 'a1' }) });
  const event = {
    params: { id: 'p1' },
    url: new URL('https://site.com/api/pages/p1/lock'),
    locals: {
      user: { id: 's1', isStaff: true },
      rime: {
        routes: { slug: 'pages' },
        config: { isCollection: () => true, isArea: () => true },
        collection: () => ({ config, system }),
        area: () => ({ config, system })
      }
    }
  } as any;
  return { event, update };
};

describe('the lock routes', () => {
  it('ask the update rule with the request, as a save does', async () => {
    const page = setup();
    await restLock(page.event);
    expect(page.update).toHaveBeenCalledWith(page.event.locals.user, {
      event: page.event,
      id: 'p1'
    });

    const area = setup();
    await restLockArea(area.event);
    expect(area.update).toHaveBeenCalledWith(area.event.locals.user, { event: area.event });
  });
});
