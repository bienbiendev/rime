import type { BuiltCollection } from '$lib/core/config/types.js';
import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { addAddresses, withAddress } from '../addresses.server.js';

/** A new page gets its address in every locale: a slug from its title, under its parent, a url. */
export const createPaths = Hooks.afterCreate<'generic'>(async function createPaths(args) {
  const { event, doc } = args;
  const config = args.config as BuiltCollection;
  await addAddresses({ event, config, ids: [doc.id] });
  return { ...args, doc: await withAddress({ event, config, doc }) };
});
