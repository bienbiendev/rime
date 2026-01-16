import { AppWindowMac, BookType, SlidersVertical } from '@lucide/svelte';

import { adapterSqlite } from '$lib/adapter-sqlite/index.server';
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
	$smtp: {
		from: process.env.RIME_SMTP_USER,
		host: process.env.RIME_SMTP_HOST,
		port: parseInt(process.env.RIME_SMTP_PORT || '465'),
		auth: {
			user: process.env.RIME_SMTP_USER,
			password: process.env.RIME_SMTP_PASSWORD
		}
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
