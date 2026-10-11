import { PARAMS } from '#lib/core/constants.js';
import { t__ } from '#lib/core/i18n/index.js';
import type { BuiltPrototype } from '#lib/core/prototype/define.js';
import { retireAutoSaves } from '#lib/core/prototype/shared/versions/retire-auto-saves.server.js';
import type { GenericDoc } from '#lib/core/prototype/types.js';
import type { RequestEvent } from '@sveltejs/kit';

/** What the panel's save asks for in its query string. */
export const saveParams = (event: RequestEvent) => {
  const params = event.url.searchParams;
  return {
    versionId: params.get(PARAMS.VERSION_ID) || undefined,
    fork: params.get(PARAMS.FORK) === 'true',
    autoSave: params.get(PARAMS.AUTO_SAVE) === 'true'
  };
};

/**
 * The action's answer once the document is written. An auto-save answers the document only; a
 * save retires the saver's other auto-saves; a fork redirects to `documentUrl` on the new version.
 */
export const answerSave = async (args: {
  event: RequestEvent;
  config: BuiltPrototype;
  document: GenericDoc;
  fork: boolean;
  autoSave: boolean;
  documentUrl: string;
}) => {
  const { event, config, document, fork, autoSave, documentUrl } = args;
  const { user } = event.locals;

  // An auto-save is silent: the form merges the document back and nothing else moves.
  if (autoSave) return { document };

  // A save is where the saver's auto-saves of the document end, except the row it landed on.
  if (user) {
    await retireAutoSaves({
      event,
      config,
      docId: document.id,
      userId: user.id,
      keep: document.versionId as string | undefined
    });
  }

  if (fork && 'versionId' in document) {
    return {
      document,
      message: t__('common.version_created'),
      redirectUrl: `${documentUrl}?${PARAMS.VERSION_ID}=${document.versionId}`
    };
  }
  return { document, message: t__('common.doc_updated') };
};
