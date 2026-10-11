import { deleteAuthApiKey, deleteAuthUser } from '#lib/core/auth/better-auth-tables.server.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';

/**
 * After a delete, removes the document's twin in better-auth: the key of an api-key document, the
 * user of any other auth document.
 *
 * Writes the tables directly, so better-auth's own rules (only a key's creator deletes it, nobody
 * removes themselves) never leave behind a twin of a document rime's access let go.
 */
export const deleteBetterAuthUser = Hooks.afterDelete<'auth'>(
  async function deleteBetterAuthUser(args) {
    const { doc, event, config } = args;
    const { adapter } = event.locals.rime;

    // On a key document, `authUserId` is the key's creator: only the key goes.
    if (config.auth?.type === 'apiKey') {
      if (doc.apiKeyId) {
        await deleteAuthApiKey(adapter, { apiKeyId: doc.apiKeyId });
      }
      return args;
    }

    if (doc.authUserId) {
      await deleteAuthUser(adapter, { authUserId: doc.authUserId });
    }
    return args;
  }
);
