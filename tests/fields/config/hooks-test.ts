import { relation, richText, select, text } from '$lib/fields/index.js';
import { access } from '$lib/util/access/index.js';
import { Collection } from '$rime/config';

export const HooksTest = Collection.create('hooksTest', {
  fields: [
    text('title').isTitle(),

    // beforeValidate -> validate coercion chain, text
    text('magicText')
      .beforeValidate((value) => 'foo')
      .validate((value) => (value === 'foo' ? true : 'expected foo')),

    // same, localized
    text('magicTextLocalized')
      .localized()
      .beforeValidate((value) => 'foo')
      .validate((value) => (value === 'foo' ? true : 'expected foo')),

    // server-only beforeSave
    text('taggedText').$beforeSave((value) => (value ? `${value}-tagged` : value)),

    // server-only beforeRead
    text('shoutedText').$beforeRead((value) => (value ? String(value).toUpperCase() : value)),

    // field-level access
    text('adminOnly').access({
      read: (user) => access.isAdmin(user),
      create: (user) => access.isAdmin(user),
      update: (user) => access.isAdmin(user)
    }),

    // beforeValidate -> validate coercion chain, select (replaces the built-in default validator)
    select('status')
      .options('draft', 'published')
      .beforeValidate((value) => 'published')
      .validate((value) => (value === 'published' ? true : 'expected published')),

    // no custom hooks: built-in ensureSelectIsOption default validator, single value
    select('statusPlain').options('draft', 'published'),

    // no custom hooks: built-in ensureSelectIsOption default validator, many values
    select('tags').options('a', 'b', 'c').many(),

    // server-only beforeRead on a structured (JSONContent) value, not a string
    richText('body').$beforeRead((value) => (value ? { ...value, readAt: true } : value)),

    // beforeValidate running through $rime/runtime (relation/runtime.server.ts), single
    relation('related').to('targets'),

    // same, many
    relation('relatedMany').to('targets').many()
  ]
});
