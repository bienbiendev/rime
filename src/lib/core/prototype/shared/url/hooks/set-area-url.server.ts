import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { formatUrl } from '../format.server.js';

/** An area's url, built on read: one document, no parent, nothing stored. */
export const setAreaUrl = Hooks.beforeRead<'generic'>(async function setAreaUrl(args) {
  const { config, context } = args;
  const url = formatUrl({ config, doc: args.doc, path: '', locale: context.params.locale ?? '' });
  return { ...args, doc: { ...args.doc, url } };
});
