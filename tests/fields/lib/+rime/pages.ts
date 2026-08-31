import {
  block,
  blocks,
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
  separator,
  slug,
  text,
  textarea,
  time,
  toggle,
  tree
} from '$lib/fields/index.js';
import { access } from '$lib/core/features/auth/access.js';
import { Collection } from '$rime/config';

const blockParagraph = block('paragraph').fields(richText('text'));
const blockImage = block('image').fields(relation('image').to('targets'));

// A relation nested inside a tree nested inside a block — three levels
// deep, mirroring the real keyFacts pattern used in +rime/pages/tab-layout.ts.
const blockKeyFacts = block('keyFacts').fields(
  tree('facts')
    .fields(text('label'), relation('image').to('targets'))
    .renderTitle(({ values }) => values.label)
);

export const Pages = Collection.create('pages', {
  fields: [
    text('title').isTitle().required(),

    // visibility: hides slug when isHome is checked
    toggle('isHome').label('Homepage'),
    slug('slug')
      .slugify('title')
      .condition((_, siblings) => siblings.isHome !== true),

    // onChange sync between sibling fields, mirrors
    // core/config/shared/upload-directories.ts's name -> id derivation
    text('firstName'),
    text('lastName').onChange((value, { useField }) => {
      const first = useField('firstName');
      const full = useField('fullName');
      full.value = `${first.value ?? ''} ${value ?? ''}`.trim();
    }),
    text('fullName'),

    // disabled depending on user access
    text('restrictedField').access({
      read: () => true,
      create: (user) => access.isAdmin(user),
      update: (user) => access.isAdmin(user)
    }),

    // onChange on non-text field types, each mirrored into its own text
    // field so assertions can just read a plain input value
    select('category')
      .options('news', 'blog', 'docs')
      .onChange((value, { useField }) => {
        useField('categoryLabel').value = value ? `Selected: ${value}` : '';
      }),
    text('categoryLabel'),

    checkbox('featured').onChange((value, { useField }) => {
      useField('featuredLabel').value = value ? 'Yes' : 'No';
    }),
    text('featuredLabel'),

    toggle('published').onChange((value, { useField }) => {
      useField('publishedLabel').value = value ? 'Live' : 'Draft';
    }),
    text('publishedLabel'),

    number('priority')
      .min(0)
      .max(10)
      .onChange((value, { useField }) => {
        useField('priorityLabel').value = value != null ? `Priority ${value}` : '';
      }),
    text('priorityLabel'),

    relation('thumbnail').to('targets'),
    richText('intro'),
    date('publishDate'),
    time('publishTime'),
    email('contactEmail'),
    radio('layoutStyle').options('a', 'b', 'c'),
    combobox('tag').options('x', 'y', 'z'),

    // Presentational field sitting alongside a group at the same nesting
    // level — regression guard for the empty-name-key bug (separator()
    // fields never get a name; reduceFieldsToBlankDocument used to stamp
    // `prev[''] = null` here, which corrupted this whole fields level into
    // looking array-like once flattened/unflattened through a real form
    // submission — see util/doc.ts).
    separator(),

    // Group with many different field types inside — each one needs to
    // survive an edit + save + reload round trip independently.
    group('meta').fields(
      text('metaTitle'),
      textarea('metaDescription'),
      checkbox('metaFeatured'),
      toggle('metaPublished'),
      select('metaCategory').options('news', 'blog', 'docs'),
      number('metaPriority').min(0).max(10)
    ),

    blocks('sections', [blockParagraph, blockImage, blockKeyFacts]),

    tree('links').fields(text('label'), link('url').types('url'))
  ]
});
