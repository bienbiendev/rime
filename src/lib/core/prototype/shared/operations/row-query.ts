import { readableReferences } from '#lib/core/fields/util.js';
import type { PrototypeApiContext } from '../../define.js';
import type { ReadArgs } from './read-args.js';

/**
 * What a single-document read asks the adapter for: the locale and its fallback, the selected
 * fields, the references the caller may resolve, and which version row.
 */
export const rowQuery = (ctx: PrototypeApiContext, args: ReadArgs) => {
  const { config, event, isSystemOperation } = ctx;
  return {
    locale: args.locale,
    localeFallback: args.localeFallback,
    select: args.select,
    resolve: isSystemOperation ? undefined : readableReferences(config.fields, event.locals.user),
    // `latest` and `versionId` are request parameters; which row they name is the feature's answer.
    content: ctx.versionQuery({ latest: args.latest, versionId: args.versionId })
  };
};
