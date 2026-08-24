import {
  checkbox,
  combobox,
  date,
  email,
  group,
  link,
  number,
  radio,
  relation,
  richText,
  select,
  slug,
  text,
  textarea,
  time,
  toggle
} from '$lib/fields/index.js';
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

    // field-level access — same {read, create, update} shape checked across
    // a spread of structurally different field types (plain scalar,
    // boolean x2, options-based, numeric, relational, temporal), since the
    // access mechanism lives once on FormFieldBuilder but every leaf field
    // component reads it independently.
    text('adminOnly').access({
      read: (user) => access.isAdmin(user),
      create: (user) => access.isAdmin(user),
      update: (user) => access.isAdmin(user)
    }),
    checkbox('adminOnlyCheckbox').access({
      read: (user) => access.isAdmin(user),
      create: (user) => access.isAdmin(user),
      update: (user) => access.isAdmin(user)
    }),
    toggle('adminOnlyToggle').access({
      read: (user) => access.isAdmin(user),
      create: (user) => access.isAdmin(user),
      update: (user) => access.isAdmin(user)
    }),
    select('adminOnlySelect')
      .options('a', 'b')
      .access({
        read: (user) => access.isAdmin(user),
        create: (user) => access.isAdmin(user),
        update: (user) => access.isAdmin(user)
      }),
    number('adminOnlyNumber').access({
      read: (user) => access.isAdmin(user),
      create: (user) => access.isAdmin(user),
      update: (user) => access.isAdmin(user)
    }),
    relation('adminOnlyRelation')
      .to('targets')
      .access({
        read: (user) => access.isAdmin(user),
        create: (user) => access.isAdmin(user),
        update: (user) => access.isAdmin(user)
      }),
    date('adminOnlyDate').access({
      read: (user) => access.isAdmin(user),
      create: (user) => access.isAdmin(user),
      update: (user) => access.isAdmin(user)
    }),

    // Second access tier: readable by anyone (so RenderFields.svelte's
    // authorizedFields filter still renders it — that filter runs on
    // canRead alone), but only an admin can create/update it. Distinct from
    // adminOnly* above: an editor sees these fields disabled rather than
    // not seeing them at all. Same spread of field types.
    checkbox('restrictedCheckbox').access({
      read: () => true,
      create: (user) => access.isAdmin(user),
      update: (user) => access.isAdmin(user)
    }),
    toggle('restrictedToggle').access({
      read: () => true,
      create: (user) => access.isAdmin(user),
      update: (user) => access.isAdmin(user)
    }),
    select('restrictedSelect')
      .options('a', 'b')
      .access({
        read: () => true,
        create: (user) => access.isAdmin(user),
        update: (user) => access.isAdmin(user)
      }),
    number('restrictedNumber').access({
      read: () => true,
      create: (user) => access.isAdmin(user),
      update: (user) => access.isAdmin(user)
    }),
    relation('restrictedRelation')
      .to('targets')
      .access({
        read: () => true,
        create: (user) => access.isAdmin(user),
        update: (user) => access.isAdmin(user)
      }),
    date('restrictedDate').access({
      read: () => true,
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
    relation('relatedMany').to('targets').many(),

    // custom validate, boolean must be true
    checkbox('agree')
      .defaultValue(false)
      .validate((value) => (value === true ? true : 'must accept terms')),

    // server-only beforeSave inverting a primitive boolean (not a string/object)
    toggle('featured').$beforeSave((value) => !value),

    // beforeValidate clamping a number into range before the built-in min/max validate runs
    number('score')
      .min(0)
      .max(100)
      .beforeValidate((value) =>
        typeof value === 'number' ? Math.min(100, Math.max(0, value)) : value
      ),

    // built-in beforeValidate (string -> Date) already runs first; this one
    // pins the year, proving hooks chain/append rather than replace
    date('publishedAt').beforeValidate((value) => {
      const asDate = value instanceof Date ? value : new Date(value as any);
      asDate.setUTCFullYear(2030);
      return asDate;
    }),

    // beforeValidate -> validate coercion chain, time (keeps the built-in format validator)
    time('openAt').beforeValidate((value) => '09:00'),

    // beforeSave lowercasing after the built-in sanitize hook; built-in validate.email still guards format
    email('contact').$beforeSave((value) => (value ? String(value).toLowerCase() : value)),

    // beforeValidate normalizing input before the built-in validate.slug format check
    slug('slugField').beforeValidate((value) =>
      typeof value === 'string' ? value.toLowerCase() : value
    ),

    // beforeSave trimming whitespace
    textarea('notes').$beforeSave((value) => (typeof value === 'string' ? value.trim() : value)),

    // beforeValidate remapping one specific value, then falling through to the
    // built-in ensureSelectIsOption check (untouched) on the remapped value
    radio('priority')
      .options('low', 'medium', 'high')
      .beforeValidate((value) => (value === 'urgent' ? 'high' : value)),

    // beforeSave substituting a specific value server-side
    combobox('framework')
      .options('svelte', 'react', 'vue')
      .$beforeSave((value) => (value === 'react' ? 'svelte' : value)),

    // beforeValidate forcing a property on an object value; beforeRead
    // (populateRessourceURL) also goes through $rime/runtime (see
    // link/index.ts) — a second, independent consumer besides relation
    link('resourceLink')
      .types('url')
      .beforeValidate((value) =>
        value && typeof value === 'object' ? { ...value, target: '_blank' } : value
      ),

    // Hooks nested inside a group — same three hook shapes as their
    // top-level counterparts (beforeValidate -> validate coercion,
    // server-only $beforeSave, beforeValidate clamp), proving the hook
    // pipeline threads correctly through group-prefixed configMap paths
    // (e.g. "nested.nestedMagicText") rather than just bare field names.
    group('nested').fields(
      text('nestedMagicText')
        .beforeValidate((value) => 'foo')
        .validate((value) => (value === 'foo' ? true : 'expected foo')),
      text('nestedTaggedText').$beforeSave((value) => (value ? `${value}-tagged` : value)),
      number('nestedScore')
        .min(0)
        .max(100)
        .beforeValidate((value) =>
          typeof value === 'number' ? Math.min(100, Math.max(0, value)) : value
        )
    )
  ]
});
