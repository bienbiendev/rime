import { SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER } from '$app/env/private';
import { adapterSqlite } from '#lib/adapter-sqlite/index.server.js';
import { access } from '#lib/core/auth/access.js';
import { rime } from '$rime/config';
import { Articles } from './articles';
import { ContactLogs, Contacts, Notices, PrivateDocs, PrivateMedias, Reports } from './safety';
import { Defaults } from './defaults';
import { Homepage } from './homepage';
import { HooksTest } from './hooks-test';
import { Medias } from './medias';
import { Pages } from './pages';
import { Bulletins } from './read-only';
import { Listings } from './listings';
import { Settings } from './settings';
import { ProductIdeas, Targets } from './targets';

export default rime({
  $adapter: adapterSqlite('fields.sqlite'),

  collections: [
    HooksTest,
    Targets,
    ProductIdeas,
    Medias,
    Pages,
    Defaults,
    Articles,
    Contacts,
    ContactLogs,
    PrivateMedias,
    PrivateDocs,
    Notices,
    Reports,
    Bulletins,
    Listings
  ],
  areas: [Settings, Homepage],

  // Defaults to admin-only (features/panel/augment.server.ts) — relaxed to any
  // staff member so the editor account can reach the panel UI at all, which
  // is the precondition for testing field-level .access() restrictions
  // through the panel (see pages.test.ts's disabled/access test).
  panel: {
    $access: (user) => access.isStaff(user)
  },

  $smtp: {
    from: SMTP_USER,
    host: SMTP_HOST,
    port: SMTP_PORT,
    auth: {
      user: SMTP_USER,
      password: SMTP_PASSWORD
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
