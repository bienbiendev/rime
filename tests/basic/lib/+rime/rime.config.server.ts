import AppWindowMac from '@lucide/svelte/icons/app-window-mac';
import BookType from '@lucide/svelte/icons/book-type';
import SlidersVertical from '@lucide/svelte/icons/sliders-vertical';

import { adapterSqlite } from '#lib/adapter-sqlite/index.server.js';
import { rime } from '$rime/config';
import { Apps } from './app';
import { Informations } from './informations';
import { Medias } from './medias';
import { Navigation } from './navigation';
import { News } from './news';
import { Pages } from './pages';
import { Settings } from './settings';
import { Users } from './users';

export default rime({
  $adapter: adapterSqlite('basic.sqlite'),
  collections: [Pages, Medias, News, Users, Apps],
  areas: [Settings, Navigation, Informations],
  // nodemailer's JSON transport: sendMail resolves, and no mail leaves the machine
  $smtp: {
    from: 'rime@example.com',
    host: undefined,
    port: undefined,
    auth: { user: undefined, password: undefined },
    jsonTransport: true
  },
  staff: {
    roles: [{ value: 'editor' }]
  },
  panel: {
    navigation: {
      groups: [
        { label: 'content', icon: BookType },
        { label: 'global', icon: AppWindowMac },
        { label: 'system', icon: SlidersVertical }
      ]
    }
  }
});
