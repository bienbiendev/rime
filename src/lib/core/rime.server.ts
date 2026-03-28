// import type { Adapter } from '$lib/adapter-sqlite/index.server.js';
import { dev } from '$app/environment';
import type { Config } from '$lib/core/config/types.js';
import devCache from '$lib/core/dev/cache/index.js';
import type { RegisterArea, RegisterCollection } from '$lib/index.js';
import type { RequestEvent } from '@sveltejs/kit';
import { betterAuth } from 'better-auth';
import { AreaAPI } from './areas/local-api.server.js';
import { CollectionAPI } from './collections/local-api.server.js';
import { getBaseAuthConfig } from './config/auth/better-auth.server.js';
import { createConfigContext } from './config/config-context.server.js';
import type { BuildConfig } from './config/server/index.server.js';
import validate from './config/server/validate.js';
import writeMemo from './config/server/write.js';
import generateRoutes from './dev/generate/routes/index.js';
import generateTypes from './dev/generate/types/index.js';
import { RimeError } from './errors/index.js';
import i18n from './i18n/index.js';
import { registerTranslation } from './i18n/register.server.js';
import { logger } from './logger/index.server.js';

export type Rime<C extends Config = Config> = Awaited<ReturnType<typeof createRime<C>>>;
export type RimeContext<C extends Config = Config> = ReturnType<Rime<C>['createRimeContext']>;
export type ConfigContext<C extends Config = Config> = ReturnType<typeof createConfigContext<C>>;

/**
 * Creates the main Rime object
 * that provides access to cms API
 */
export async function createRime<const C extends Config>(config: BuildConfig<C>) {
	// Normalize plugins to a simple name->actions map
	const serverPlugins = config.$plugins;
	const plugins = Object.fromEntries(
		serverPlugins.map((plugin) => [plugin.name, plugin.actions ?? {}])
	) as typeof config.$InferPluginsServer;

	// Creat config interface
	const configCtx = createConfigContext(config);

	// Init adapter to get the generateSchema
	const { createAdapter, generateSchema } = config.$adapter;

	// Generate schema, types, routes
	if (dev) {
		const changed = writeMemo(config);
		const valid = changed && validate(config);
		if (changed && !valid) throw new RimeError('Config not valid');
		devCache.set('.init', new Date().toISOString());
		generateRoutes(config);
		await generateSchema(config);
		await generateTypes(config);
	}

	// Create adapter, consume the generated schema
	const adapter = await createAdapter(configCtx);

	// Create auth
	const baseAuthconfig = getBaseAuthConfig({ mailer: plugins.mailer, config: configCtx });
	type BetterAuthPlugins = typeof config.$InferAuthPlugins;
	const betterAuthPlugins = Array.isArray(config.$auth?.plugins)
		? [...baseAuthconfig.plugins, ...(config.$auth.plugins as BetterAuthPlugins)]
		: baseAuthconfig.plugins;

	const auth = betterAuth({
		...baseAuthconfig,
		plugins: betterAuthPlugins,
		database: adapter.auth.betterAuthAdapter
	});

	// Register translation
	// Register dictionaries for panel Language
	const dictionnaries = await registerTranslation(config.panel.language);
	i18n.init(dictionnaries);

	if (dev) {
		devCache.delete('.init');
	}

	/**
	 * Function that define the locale to use in a request event
	 * based on this priority, high to low :
	 * - locale inside the url ex: /en/foo
	 * - locale from searchParams ex: ?locale=en
	 * - locale from cookie
	 * - default locale
	 */
	function defineLocale(event: RequestEvent) {
		// locale present inside the url params ex : /en/foo
		const params = event.params;
		const paramLocale =
			'locale' in params && typeof params.locale === 'string' ? params.locale : null;

		// locale present as a search param ex : ?locale=en
		const searchParams = event.url.searchParams;
		const hasParams = searchParams.toString();
		const searchParamLocale = hasParams && searchParams.get('locale');

		// locale from the cookie
		const cookieLocale = event.cookies.get('rime.locale');
		const defaultLocale = configCtx.getDefaultLocale();
		const locale = paramLocale || searchParamLocale || cookieLocale;

		if (locale && configCtx.getLocalesCodes().includes(locale)) {
			return (event.locals.locale = locale);
		}
		return (event.locals.locale = defaultLocale);
	}

	return {
		defineLocale,

		get auth() {
			return auth;
		},

		get adapter() {
			return adapter;
		},

		get config() {
			return configCtx;
		},

		get plugins() {
			return plugins;
		},

		createRimeContext(event: RequestEvent) {
			defineLocale(event);
			return {
				logger,

				...plugins,

				/** The Better-auth instance */
				get auth() {
					return auth;
				},

				/**
				 * Provides access to the drizzle instance and some
				 * low level functionnalities
				 *
				 * @example
				 * rime.adapter.db.query.pages.findFirst()
				 * rime.adatpter.auth.getUserAttributes({ authUserId: '12345', slug: 'users' })
				 */
				get adapter() {
					return adapter;
				},

				/**
				 * The configuration interface
				 *
				 * @example
				 * rime.config.raw // <- full config object
				 * rime.config.getBySlug('posts') // <- Collection config
				 * rime.config.areas // <- Areas config
				 */
				get config() {
					return configCtx;
				},

				/**
				 * This overrides the event.locals.locale.
				 */
				setLocale(locale: string | undefined) {
					event.locals.locale = locale;
				},

				/**
				 * Get the current event.locals.locale
				 */
				getLocale() {
					return event.locals.locale;
				},

				/**
				 * Get a collection api
				 * @example
				 *
				 * rime.collection('pages').find({ query: 'where[isHome][equals]=true' })
				 */
				collection<Slug extends keyof RegisterCollection>(slug: Slug) {
					const collectionConfig = configCtx.collections[slug];
					return new CollectionAPI<RegisterCollection[Slug]>({
						event,
						config: collectionConfig,
						defaultLocale: configCtx.getDefaultLocale()
					});
				},

				/**
				 * Get an area api
				 * rime.area('settings').find()
				 */
				area<Slug extends keyof RegisterArea>(slug: Slug) {
					const areaConfig = configCtx.areas[slug];
					return new AreaAPI<RegisterArea[Slug]>({
						event,
						config: areaConfig,
						defaultLocale: configCtx.getDefaultLocale()
					});
				}
			};
		}
	} as const;
}
