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
  slug,
  text,
  textarea,
  time,
  toggle,
  tree
} from '$lib/fields/index.js';
import { access } from '$lib/util/access/index.js';
import { Collection } from '$rime/config';

const blockParagraph = block('paragraph').fields(richText('text'));
const blockImage = block('image').fields(relation('image').to('targets'));

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

    select('category').options('news', 'blog', 'docs'),
    relation('thumbnail').to('targets'),
    richText('intro'),
    checkbox('featured'),
    toggle('published'),
    number('priority').min(0).max(10),
    date('publishDate'),
    time('publishTime'),
    email('contactEmail'),
    radio('layoutStyle').options('a', 'b', 'c'),
    combobox('tag').options('x', 'y', 'z'),

    group('meta').fields(text('metaTitle'), textarea('metaDescription')),

    blocks('sections', [blockParagraph, blockImage]),

    tree('links').fields(text('label'), link('url').types('url'))
  ]
});
