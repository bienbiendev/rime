import { describe, expect, it, vi } from 'vitest';
import { populateAPIKey } from './populate-api-key.server.js';

describe('populateAPIKey', () => {
  it('mails the key to its creator once the document exists, and puts it on the document', async () => {
    const sendMail = vi.fn(async () => {});
    const result = await populateAPIKey({
      config: { slug: 'apiKeys', auth: { type: 'apiKey' } },
      event: { locals: { user: { email: 'u1@site.com' }, rime: { mailer: { sendMail } } } },
      doc: { id: 'd1', name: 'Mobile app' },
      context: { apiKey: 'secret' },
      operation: 'create'
    } as never);

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'u1@site.com' }));
    expect(result.doc).toMatchObject({ id: 'd1', apiKey: 'secret' });
  });
});
