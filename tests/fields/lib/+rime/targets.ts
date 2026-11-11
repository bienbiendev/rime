import { text } from '#lib/fields/index.js';
import { Collection, Hooks } from '$rime/config';

// A target titled `defaults-target-<n>` takes its title as id: the ids the defaults fixture's
// relation defaults name. A create drops the id its data sends.
const takeDefaultsTargetId = Hooks.beforeCreate<'targets'>(
  async function takeDefaultsTargetId(args) {
    const title = args.data.title;
    if (!title?.startsWith('defaults-target-')) return args;
    return { ...args, data: { ...args.data, id: title } };
  }
);

// The plain relation target of pages, hooksTest and defaults
export const Targets = Collection.create('targets', {
  fields: [text('title').isTitle()],
  $hooks: { beforeCreate: [takeDefaultsTargetId] }
});

// A camelCase slug that holds `Id`: its junction column is `productIdeasId`
export const ProductIdeas = Collection.create('productIdeas', {
  fields: [text('title').isTitle()]
});
