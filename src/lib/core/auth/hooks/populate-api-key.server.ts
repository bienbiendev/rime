import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { RimeError } from '#lib/core/errors/index.js';
import { t__ } from '#lib/core/i18n/index.js';

/**
 * After the create of an api-key document, mails the key to its creator and puts it on the
 * document, so they see it once.
 */
export const populateAPIKey = Hooks.afterCreate<'auth'>(async function populateAPIKey(args) {
  const { config, event } = args;

  const IS_API_AUTH = config.auth && config.auth.type === 'apiKey';

  if (IS_API_AUTH) {
    if (!args.context.apiKey)
      throw new RimeError(RimeError.OPERATION_ERROR, 'missing key @populateAPIKey');

    // The key goes out once the document holding it exists. `rime.mailer` is typed `never` when
    // the app has no smtp config.
    await (event.locals.rime.mailer as any).sendMail({
      to: event.locals.user!.email,
      subject: t__(`mail.api_key_created_subject`, args.doc.name),
      text: t__(`mail.api_key_created_text`, args.doc.name, args.context.apiKey)
    });

    return {
      ...args,
      doc: {
        ...args.doc,
        apiKey: args.context.apiKey
      }
    };
  }

  return args;
});
