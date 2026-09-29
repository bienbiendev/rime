import { Area, Collection, rime } from '$rime/config';
import { consumerField } from '@rimecms/test-consumer-field';
import { consumerPlugin } from '@rimecms/test-consumer-plugin';
import { adapterSqlite } from 'rimecms/adapter-sqlite';
import { relation, text, toggle } from 'rimecms/fields';

// Exercises a third-party field's own client/server split (consumerField's server hook
// prefixes the saved value — see @bienbien/rime-consumer-field/module.server.ts) on a
// collection the plugin below also extends, so both packages touch the same document.
// Two foreign key cascades, checked on either driver: `related` rows go when the page they point
// at is deleted, and a rename is carried down the addresses of the nested pages under it.
const Pages = Collection.create('pages', {
  nested: true,
  $url: ({ path }) => `/${path.join('/')}`,
  fields: [
    text('title').isTitle().required(),
    consumerField('note'),
    relation('related').to('pages').many()
  ]
});

const Medias = Collection.create('medias', {
  upload: true,
  fields: [text('alt').required()]
});

// A plain consumer-owned area, unrelated to either package — proves neither one had to be
// involved for ordinary config to keep working alongside them.
const Settings = Area.create('settings', {
  fields: [toggle('maintenance').label('Maintenance mode')],
  access: {
    read: () => true
  }
});

export default rime({
  $adapter: adapterSqlite('consumer.sqlite'),
  collections: [Pages, Medias],
  areas: [Settings],
  // consumerPlugin() adds its own `pluginVisits` collection, a `consumerPluginNote` field +
  // an afterUpdate hook on `pages`, a header button, an /api/consumer-plugin/ping route, and
  // an x-consumer-plugin response header — see @bienbien/rime-consumer-plugin's module.server.ts.
  plugins: [consumerPlugin()]
});
