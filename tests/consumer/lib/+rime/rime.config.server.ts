import { Area, Collection, rime } from '$rime/config';
import { consumerField } from '@rimecms/test-consumer-field';
import { consumerPlugin } from '@rimecms/test-consumer-plugin';
import { adapterSqlite } from 'rimecms/adapter-sqlite';
import { text, toggle } from 'rimecms/fields';

// Exercises a third-party field's own client/server split (consumerField's server hook
// prefixes the saved value — see @bienbien/rime-consumer-field/module.server.ts) on a
// collection the plugin below also extends, so both packages touch the same document.
const Pages = Collection.create('pages', {
  fields: [text('title').isTitle().required(), consumerField('note')]
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
