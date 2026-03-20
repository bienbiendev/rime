import type { SMTPConfig } from '$lib/core/plugins/mailer/index.server.js';
import { createRime } from '../../rime.server.js';
import { augmentPanel } from '../client/augment-panel.js';
import { augmentPlugins } from '../client/augment-plugins.js';
import { augmentIcons } from '../shared/augment-icons.js';
import { augmentPrototypes } from '../shared/augment-prototypes.js';
import { makeVersionsCollectionsAliases } from '../shared/versions-alias.server.js';
import type { Config } from '../types.js';
import { augmentCORS } from './augment-cors.js';
import { augmentDirectoriesServer } from './augment-directories.server.js';
import { augmentPanelAccess } from './augment-panel-access.server.js';
import { augmentPluginsServer } from './augment-plugins.server.js';
import { augmentStaffServer } from './augment-staff.server.js';

export const buildConfig = <const C extends Config>(config: C) => {
	const augmented = augmentConfig(config);
	// Versions collection aliases
	// create {slug}_versions collections
	const output = makeVersionsCollectionsAliases(augmented);
	return createRime(output as any as BuildConfig<C>);
};

function augmentConfig<T extends Config>(config: T) {
	const withStaff = augmentStaffServer(config);
	const withPrototype = augmentPrototypes(withStaff);
	const withIcons = augmentIcons(withPrototype);
	const withPanel = augmentPanel(withIcons);
	const withPanelAccess = augmentPanelAccess(withPanel);
	const withCORS = augmentCORS(withPanelAccess);
	const withPluginsServer = augmentPluginsServer(withCORS);
	const withDirectories = augmentDirectoriesServer(withPluginsServer);
	const output = augmentPlugins(withDirectories);
	return output;
}

type InferCollections<C> = C extends { collections?: readonly any[] }
	? {
			[K in NonNullable<C['collections']>[number] as K extends { slug: infer N }
				? N extends string
					? N
					: never
				: never]: K;
		}
	: Record<string, never>;

type InferAreas<C> = C extends { areas?: readonly any[] }
	? {
			[K in NonNullable<C['areas']>[number] as K extends { slug: infer N }
				? N extends string
					? N
					: never
				: never]: K;
		}
	: Record<string, never>;

type InferCollectionsSlug<C> = C extends { collections?: readonly any[] }
	? NonNullable<C['collections']>[number] extends { slug: infer N }
		? N extends string
			? N
			: never
		: never
	: Array<never>;

type InferAreasSlug<C> = C extends { areas?: readonly any[] }
	? NonNullable<C['areas']>[number] extends { slug: infer N }
		? N extends string
			? N
			: never
		: never
	: Array<never>;

type InferCorePlugins<C extends Config> = {
	cache: import('$lib/core/plugins/cache/index.server.js').CacheActions;
	sse: import('$lib/core/plugins/sse/index.server.js').SSEActions;
} & (C['$smtp'] extends SMTPConfig
	? { mailer: import('$lib/core/plugins/mailer/index.server.js').MailerActions }
	: Record<string, never>);

// Helper type to extract custom plugins from original config
type ExtractCustomPlugins<C> = C extends { $plugins: readonly (infer P)[] }
	? P extends { name: infer N; actions?: infer A }
		? N extends string
			? Record<N, NonNullable<A>>
			: never
		: never
	: Record<string, never>;

type InferPluginsServer<C extends Config> = InferCorePlugins<C> & ExtractCustomPlugins<C>;

export type BuildConfig<C extends Config = Config> = ReturnType<typeof augmentConfig<C>> & {
	readonly $InferAuthPlugins: C['$auth'] extends { plugins: any } ? C['$auth']['plugins'] : [];
	readonly $InferRoutes: C['$routes'] extends Record<string, any> ? C['$routes'] : unknown;
	readonly $InferPluginsServer: InferPluginsServer<C>;
	readonly $InferCollections: InferCollections<C>;
	readonly $InferAreas: InferAreas<C>;
	readonly $InferAreasSlug: InferAreasSlug<C>;
	readonly $InferCollectionsSlug: InferCollectionsSlug<C>;
};
