import { Area, Collection, rime } from '$rime/config';
import { consumerField } from '@rimecms/test-consumer-field';
import { consumerPlugin } from '@rimecms/test-consumer-plugin';
import { adapterSqlite } from 'rimecms/adapter-sqlite';
import { relation, text, toggle } from 'rimecms/fields';
import Banner from './Banner.svelte';
import Stats from './Stats.svelte';

// consumerField's server hook prefixes the saved value (@rimecms/test-consumer-field's
// module.server.ts), on a collection the plugin below also extends: both packages touch the
// same document.
//
// `related` and `nested` carry the two foreign-key cascades consumer.test.ts checks on either
// driver: deleting a page drops the relations to it, renaming one rewrites its children's urls.
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

// Hidden from the panel: no link in the sidebar
const HiddenSettings = Area.create('hiddenSettings', {
  panel: false,
  fields: [text('note')]
});

export default rime({
  $adapter: adapterSqlite('consumer.sqlite'),
  collections: [Pages, Medias],
  areas: [Settings, HiddenSettings],
  panel: {
    // A custom page with no group, listed under the Dashboard link
    routes: { stats: { label: 'Stats', component: Stats } },
    // Rendered above every collection list
    components: { collectionHeader: [Banner] }
  },
  // The cache plugin is on (RIME_CACHE_ENABLED, set by local-pack-test.sh). It caches only the
  // anonymous requests under /cache, so the other tests read what they just wrote.
  $cache: {
    isEnabled: (event) => !event.locals.user && event.url.pathname.startsWith('/cache/')
  },
  // consumerPlugin() adds its own `pluginVisits` collection, a `consumerPluginNote` field +
  // an afterUpdate hook on `pages`, a header button, an /api/consumer-plugin/ping route, and
  // an x-consumer-plugin response header — see @rimecms/test-consumer-plugin's module.server.ts.
  plugins: [consumerPlugin()]
});
