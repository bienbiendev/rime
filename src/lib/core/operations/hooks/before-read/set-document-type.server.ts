import { Hooks } from '../index.server.js';

export const setDocumentType = Hooks.beforeRead<'generic'>(async (args) => {
  const config = args.config;
  let doc = args.doc;

  const hasSelect = Array.isArray(args.context.params.select) && args.context.params.select.length;

  if (!hasSelect) {
    doc = {
      ...doc,
      _prototype: config.type,
      _type: config.slug
    };
  }

  return { ...args, doc };
});
