import { adapterSqlite } from '$lib/adapter-sqlite/index.server';
import { rime } from '$rime/config';
import { HooksTest } from './hooks-test';
import { Settings } from './settings';
import { Targets } from './targets';

export default rime({
  $adapter: adapterSqlite('fields.sqlite'),

  collections: [HooksTest, Targets],
  areas: [Settings],

  $smtp: {
    from: process.env.RIME_SMTP_USER,
    host: process.env.RIME_SMTP_HOST,
    port: parseInt(process.env.RIME_SMTP_PORT || '465'),
    auth: {
      user: process.env.RIME_SMTP_USER,
      password: process.env.RIME_SMTP_PASSWORD
    }
  },

  localization: {
    locales: [
      { code: 'fr', label: 'Français' },
      { code: 'en', label: 'English' }
    ],
    default: 'fr'
  },

  staff: {
    roles: [{ value: 'editor' }]
  }
});
