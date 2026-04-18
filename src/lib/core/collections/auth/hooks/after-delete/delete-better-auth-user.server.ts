import { Hooks } from '$lib/core/operations/hooks/index.server.js';

/**
 * After delete, delete better-auth user
 */
export const deleteBetterAuthUser = Hooks.afterDelete<'auth'>(async (args) => {
  const { doc, event, config } = args;
  const IS_API_AUTH = config.auth && config.auth?.type === 'apiKey';

  if (IS_API_AUTH && doc.apiKeyId) {
    await event.locals.rime.auth.api.deleteApiKey({
      headers: args.event.request.headers,
      body: {
        keyId: doc.apiKeyId
      }
    });
  } else if (doc.authUserId) {
    await event.locals.rime.auth.api.removeUser({
      body: {
        userId: doc.authUserId
      },
      headers: args.event.request.headers
    });
  }

  return args;
});
