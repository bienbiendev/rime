import { adapterSqlite } from '$lib/adapter-sqlite/index.server';
import { access } from '$lib/core/features/auth/access.js';
import { rime } from '$rime/config';
import { HooksTest } from './hooks-test';
import { Pages } from './pages';
import { Settings } from './settings';
import { Targets } from './targets';

export default rime({
  $adapter: adapterSqlite('fields.sqlite'),

  collections: [HooksTest, Targets, Pages],
  areas: [Settings],

  // Defaults to admin-only (augment-panel-access.server.ts) — relaxed to any
  // staff member so the editor account can reach the panel UI at all, which
  // is the precondition for testing field-level .access() restrictions
  // through the panel (see pages.test.ts's disabled/access test).
  panel: {
    $access: (user) => access.isStaff(user)
  },

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
