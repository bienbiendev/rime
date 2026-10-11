import { describe, expect, it, vi } from 'vitest';
import { handleAuth } from './index.server.js';

describe('handleAuth', () => {
  it('reads a session whose document is gone as anonymous', async () => {
    const event = {
      request: { headers: new Headers() },
      locals: {
        rime: {
          routes: { isPanel: false },
          // better-auth knows the user, the `users` collection has no document for it
          auth: {
            api: {
              getSession: async () => ({
                session: { id: 's1' },
                user: { id: 'ba1', type: 'users' }
              })
            }
          },
          adapter: { collection: () => ({ findMany: async () => [] }) }
        }
      }
    } as any;
    const resolve = vi.fn(async () => new Response('page'));

    const response = await handleAuth({ event, resolve } as never);

    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalled();
    expect(event.locals.user).toBeUndefined();
    expect(event.locals.session).toBeUndefined();
  });
});

describe('handleAuth, with an api key', () => {
  /**
   * A request with `headers`, on the panel or not. better-auth knows one key, `good`, made by the
   * better-auth user `ba1` (whose better-auth role is `creatorRole`) and carrying `roles`, and one
   * other user, `ba-admin`, a better-auth admin; the `apps` collection holds the key's document.
   * Nobody has a session.
   */
  const run = async (args: {
    headers: Record<string, string>;
    roles?: string[];
    creatorRole?: string;
    isPanel?: boolean;
  }) => {
    const verifyApiKey = vi.fn(async ({ body }: { body: { key: string } }) =>
      body.key === 'good'
        ? {
            valid: true,
            key: { id: 'k1', referenceId: 'ba1', permissions: { roles: args.roles ?? ['reports'] } }
          }
        : { valid: false, key: null }
    );
    const event = {
      request: { headers: new Headers(args.headers) },
      locals: {
        rime: {
          routes: { isPanel: !!args.isPanel, panelUrl: (path: string) => `/panel/${path}` },
          config: {
            raw: {
              collections: [
                { slug: 'staff', auth: { type: 'password' } },
                { slug: 'apps', auth: { type: 'apiKey' } }
              ],
              panel: {}
            }
          },
          auth: { api: { getSession: async () => null, verifyApiKey } },
          adapter: {
            collection: (slug: string) => ({
              findMany: async ({ query }: any) =>
                slug === 'apps' && query.where.apiKeyId?.equals === 'k1'
                  ? [{ id: 'app1', name: 'Reports app' }]
                  : []
            }),
            // better-auth's users, read by id
            table: () => ({
              find: async ({ where }: { where?: { id?: string } } = {}) =>
                [
                  { id: 'ba-admin', role: 'admin' },
                  { id: 'ba1', role: args.creatorRole ?? 'staff' }
                ].filter((row) => !where?.id || row.id === where.id)
            })
          }
        }
      }
    } as any;
    const resolve = vi.fn(async () => new Response('page'));
    // A refusal is thrown as SvelteKit's HttpError, which carries the status the same way
    const response = await Promise.resolve(handleAuth({ event, resolve } as never)).catch(
      (error: { status: number }) => error
    );
    return { event, resolve, response, verifyApiKey };
  };

  it("runs a request with a key alone as the key's document, with the key's roles", async () => {
    const { event, resolve } = await run({ headers: { 'x-api-key': 'good' } });

    expect(resolve).toHaveBeenCalled();
    expect(event.locals.user).toMatchObject({
      id: 'app1',
      name: 'Reports app',
      roles: ['reports'],
      isStaff: false
    });
    expect(event.locals.session).toBeUndefined();
  });

  it('answers 401 to a key that does not verify', async () => {
    const { response, resolve } = await run({ headers: { 'x-api-key': 'bad' } });

    expect(response.status).toBe(401);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('answers 401 to a key carrying admin when the user that made it is not a better-auth admin', async () => {
    const refused = await run({ headers: { 'x-api-key': 'good' }, roles: ['admin'] });
    expect(refused.response.status).toBe(401);

    const allowed = await run({
      headers: { 'x-api-key': 'good' },
      roles: ['admin'],
      creatorRole: 'admin'
    });
    expect(allowed.resolve).toHaveBeenCalled();
  });

  it('reads the better-auth role of the user that made the key, not of another', async () => {
    // `ba-admin` is a better-auth admin, `ba1` who made the key is not
    const { response, resolve } = await run({
      headers: { 'x-api-key': 'good' },
      roles: ['admin'],
      creatorRole: 'staff'
    });

    expect(response.status).toBe(401);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('keeps a key out of the panel', async () => {
    const { response, resolve } = await run({ headers: { 'x-api-key': 'good' }, isPanel: true });

    expect(response.status).toBe(401);
    expect(resolve).not.toHaveBeenCalled();
  });
});
