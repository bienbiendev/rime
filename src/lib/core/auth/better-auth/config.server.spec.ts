import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { describe, expect, it, vi } from 'vitest';
import { getBaseAuthConfig } from './config.server.js';

vi.mock('$app/env', () => ({ dev: true }));
vi.mock('$app/env/private', () => ({
  BETTER_AUTH_SECRET: 'a-secret-long-enough-for-better-auth-0'
}));
vi.mock('$app/env/public', () => ({ SITE_URL: 'http://localhost:5173' }));

/** better-auth as rime configures it, over an in-memory store holding one user, `u1`. */
const createAuth = () => {
  const db: Record<string, any[]> = {
    authUsers: [
      {
        id: 'u1',
        name: 'Ann',
        email: 'ann@site.com',
        emailVerified: true,
        type: 'staff',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ],
    authSessions: [],
    authAccounts: [],
    authVerifications: [],
    apikey: []
  };
  const config = {
    raw: { collections: [{ slug: 'apps', auth: { type: 'apiKey' } }], $trustedOrigins: [] }
  };
  const options = getBaseAuthConfig({ mailer: undefined, config: config as never });
  return betterAuth({ ...options, database: memoryAdapter(db) });
};

describe('the api-key plugin', () => {
  it('verifies a key on every request, with no daily quota', async () => {
    const auth = createAuth();
    const created = await auth.api.createApiKey({ body: { userId: 'u1' } });

    const answers = [];
    for (let i = 0; i < 12; i++) {
      answers.push((await auth.api.verifyApiKey({ body: { key: created.key } })).valid);
    }

    expect(answers).toEqual(Array(12).fill(true));
  });
});
