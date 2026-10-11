import { PACKAGE_NAME } from '#lib/core/constants.server.js';
import { logger } from '#lib/core/logger.server.js';
import type { CustomPanelRoute } from '#lib/core/panel/types.js';
import path from 'node:path';
import { configImportPaths, relativeImportSpecifier } from '../../constants.server.js';
import type { Routes } from './util.server.js';

const PANEL_LAYOUT_DIR = path.resolve(process.cwd(), 'src/routes/(rime)/[panel=panel]');
const LIVE_PAGE_DIR = path.resolve(process.cwd(), 'src/routes/(rime)/[panel=panel]/live-edit');

/**
 * The app's root layout server, src/routes/+layout.server.ts. Written once, when the app has
 * none: see `writeAppLayoutServer` in index.server.ts.
 */
export const mainLayout = (): string => `
import { toPublicUser } from '${PACKAGE_NAME}/server';
import type { ServerLoadEvent } from '@sveltejs/kit';

// rime's LiveEdit reads \`user\` from the page data: keep it in what this load returns.
export const load = async ({ locals }: ServerLoadEvent) => {
	return { user: toPublicUser(locals.user) };
};`;

/**
 * Error page template
 * (rime)/+error.svelte
 */
const error = (): string => `
<script>
  import { page } from '$app/state';
</script>

<div class="rz-error">
  <h1>Error {page.status}</h1>
  |
  <p>
    {page.error?.message}
  </p>
</div>

<style>
  .rz-error {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    h1 {
      font-size: 1.5rem;
      font-weight: semibold;
    }
  }
</style>
`;

/**
 * Root layout template
 * (rime)/+layout.svelte
 */
const rootLayout = () => `
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Dictionaries } from '${PACKAGE_NAME}';
	import { i18n } from '${PACKAGE_NAME}';
	import '${PACKAGE_NAME}/panel/style/index.css';

	type Props = { children: Snippet; data: { translations: Dictionaries } };

	const { children, data }: Props = $props();
	
	// svelte-ignore state_referenced_locally
	i18n.init(data.translations);
</script>

<div class="rz-root">
	{@render children()}
</div>`;

/**
 * Root layout server template
 * (rime)/+layout.server.ts
 */
const rootLayoutServer = () => `
import type { ServerLoadEvent } from '@sveltejs/kit';
import { registerTranslation, toPublicUser } from '${PACKAGE_NAME}/server';

export const ssr = false;

export const load = async ({ locals }: ServerLoadEvent) => {
	const { user, rime } = locals;
	const translations = await registerTranslation(rime.config.raw.panel.language);
	// Public here: this layout also covers sign-in/forgot-password/reset-password. The
	// panel's own nested layout (panelLayoutServer) re-supplies the full user for panel
	// pages, overriding this on the way down.
	return { user: toPublicUser(user), translations };
};`;

/**
 * Login page template
 * (rime)/[panel=panel]/sign-in/+page@(rime).svelte
 */
const signInPage = () => `
<script>
  import { SignIn } from '${PACKAGE_NAME}/panel/public';
  const { data } = $props();
</script>

<SignIn {data} />`;

/**
 * Login page server template
 * (rime)/[panel=panel]/sign-in/+page.server.ts
 */
const signInPageServer = () => `
import { type ServerLoadEvent, type RequestEvent } from '@sveltejs/kit';

export const load = (event: ServerLoadEvent) => event.locals.routes.panel.load.signIn(event);
export const actions = {
  default: (event: RequestEvent) => event.locals.routes.panel.actions.signIn(event)
};
`;

/**
 * Forgot password page template
 * (rime)/[panel=panel]/forgot-password/+page@(rime).svelte
 */
const forgotPasswordPage = () => `
<script>
  import { ForgotPassword } from '${PACKAGE_NAME}/panel/public'
  const { data } = $props();
</script>
<ForgotPassword {data} />`;

/**
 * Forgot password page server template
 * (rime)/[panel=panel]/forgot-password/+page.server.ts
 */
const forgotPasswordPageServer = () => `
import { type ServerLoadEvent } from '@sveltejs/kit';

export const load = (event: ServerLoadEvent) => event.locals.routes.panel.load.forgotPassword(event);
`;

/**
 * Reset password page template
 * (rime)/[panel=panel]/reset-password/+page@(rime).svelte
 */
const resetPasswordPage = () => `
<script>
  import { ResetPassword } from '${PACKAGE_NAME}/panel/public';
  const { data } = $props();
</script>

<ResetPassword {data} />`;

/**
 * Reset password page server template
 * (rime)/[panel=panel]/reset-password/+page.server.ts
 */
const resetPasswordPageServer = () => `
import { type ServerLoadEvent } from '@sveltejs/kit';

export const load = (event: ServerLoadEvent) => event.locals.routes.panel.load.resetPassword(event);
`;

/**
 * Panel layout template
 * (rime)/[panel=panel]/+layout.svelte
 */
const panelLayout = () => `
<script>
  import { Panel } from '${PACKAGE_NAME}/panel';
	import config from '${configImportPaths(PANEL_LAYOUT_DIR).client}';

	const { children, data } = $props();
	
	const user = $derived.by(() => {
		if (!data.user) throw new Error('unauthorized');
		return data.user;
	});
</script>

<Panel {config} {user} routes={data.routes} locale={data.locale}>
	{@render children()}
</Panel>`;

/**
 * Panel layout server template
 * (rime)/[panel=panel]/+layout.server.ts
 */
const panelLayoutServer = () => `
import { type ServerLoadEvent } from '@sveltejs/kit';

export const load = async ({ locals }: ServerLoadEvent) => {
  const { user, locale, navigation } = locals;
  return { user, locale, routes: navigation };
};`;

/**
 * Panel page template
 * (rime)/[panel=panel]/+page.svelte
 */
const panelPage = () => `
<script>
  import { Dashboard } from '${PACKAGE_NAME}/panel';
  const { data } = $props();
</script>

<Dashboard entries={data.entries} user={data.user} />`;

/**
 * Panel page load template
 * (rime)/[panel=panel]/+page.server.ts
 */
const panelPageServer = () => `
import { type ServerLoadEvent } from '@sveltejs/kit';

export const load = (event: ServerLoadEvent) => event.locals.routes.panel.load.dashboard(event);`;

/**
 * Live page template
 * (rime)/[panel=panel]/live-edit/+page@(rime).svelte
 */
const livePage = () => `
<script>
  import { Live } from '${PACKAGE_NAME}/panel';
  import config from '${configImportPaths(LIVE_PAGE_DIR).client}';

  const { data } = $props();
</script>


<Live {data} config={config} />`;

/**
 * Live page server template
 * (rime)/[panel=panel]/live-edit/+page.server.ts
 */
const livePageServer = () => `
import { type ServerLoadEvent } from '@sveltejs/kit';

export const load = (event: ServerLoadEvent) => event.locals.routes.panel.load.live(event);`;

/****************************************************/
/* The panel's /[slug=<prototype>]/... routes — fixed, generic,
/* matcher-disambiguated, generated once regardless of how many prototypes of
/* that kind are configured. The per-prototype param matchers (params.ts in the
/* generated dir, see paramsModule below) route each slug to the right folder at the
/* SvelteKit router level, so a collection page and an area page are
/* genuinely separate routes — no runtime kind-branching inside a shared
/* component, no unauthenticated-branch union fighting the component's data
/* prop type. Each reads slug/id off event.params (a real dynamic route
/* param) via event.locals.routes, so none of these import anything from
/* rimecms besides the panel components.
/*
/* These are written out per kind because the panel's loads, actions and
/* components are per kind. The /api tree is generated from each prototype's
/* declaration instead — see prototypeApiServer below.
/****************************************************/

/**
 * Collection list page
 * (rime)/[panel=panel]/[slug=collection]/+page.svelte
 */
const collectionListPage = () => `
<script>
  import { Collection } from '${PACKAGE_NAME}/panel';
  const { data } = $props();
</script>

<Collection {data} slug={data.slug} />`;

/**
 * (rime)/[panel=panel]/[slug=collection]/+page.server.ts
 */
const collectionListPageServer = () => `
import { type ServerLoadEvent } from '@sveltejs/kit';

export const load = async (event: ServerLoadEvent) => {
  const data = await event.locals.routes.panel.load.collection(event);
  return { ...data, slug: event.locals.rime.routes.slug || '' };
};`;

/**
 * Area document page
 * (rime)/[panel=panel]/[slug=area]/+page.svelte
 */
const areaDocPage = () => `
<script>
  import { Area } from '${PACKAGE_NAME}/panel';
  const { data } = $props();
</script>

<Area {data} />`;

/**
 * (rime)/[panel=panel]/[slug=area]/+page.server.ts
 */
const areaDocPageServer = () => `
import type { RequestEvent, ServerLoadEvent } from '@sveltejs/kit';

export const load = (event: ServerLoadEvent) => event.locals.routes.panel.load.area(event);

export const actions = {
  update: (event: RequestEvent) => event.locals.routes.panel.actions.area.update(event)
};`;

/**
 * Collection document page
 * (rime)/[panel=panel]/[slug=collection]/[id]/+page.svelte
 */
const collectionDocPage = () => `
<script>
  import { CollectionDoc } from '${PACKAGE_NAME}/panel';
  const { data } = $props();
</script>

<CollectionDoc {data} />`;

/**
 * (rime)/[panel=panel]/[slug=collection]/[id]/+page.server.ts
 */
const collectionDocPageServer = () => `
import type { RequestEvent, ServerLoadEvent } from '@sveltejs/kit';

export const load = (event: ServerLoadEvent) => event.locals.routes.panel.load.document(event);

export const actions = {
  create: (event: RequestEvent) => event.locals.routes.panel.actions.document.create(event),
  update: (event: RequestEvent) => event.locals.routes.panel.actions.document.update(event)
};`;

/**
 * A prototype's REST endpoint, one file per declared sub-path.
 *
 * `name`, `path` and `methods` all come from what the prototype declared in its own
 * `rest/index.server.ts`, so an area's file has no POST because an area declares no create. An
 * undeclared method stays unexported and SvelteKit answers it with 405.
 *
 * The body dispatches by name and path (see `rest` in core/routes/handler.server.ts), so this
 * file imports nothing from rimecms.
 *
 * (rime)/api/[slug=<name>]/<path>/+server.ts
 */
const prototypeApiServer = (name: string, path: string, methods: string[]) => `
import { type RequestEvent } from '@sveltejs/kit';

const handle = (event: RequestEvent) => event.locals.routes.rest('${name}', '${path}', event);

${methods.map((method) => `export const ${method} = handle;`).join('\n')}`;

/**
 * The matchers backing [panel=panel], [slug=<prototype>] and, for a config with locales, the
 * site's [[locale=locale]], keyed by matcher name — the key is what makes `[slug=collection]`
 * mean "a slug of the collection prototype". Each one bakes in its list at generation time, so
 * the module imports no config and stays isomorphic: SvelteKit runs matchers on the client too.
 *
 * ```ts
 * export const params = {
 *   panel: oneOf(['panel']),
 *   collection: oneOf(['pages', 'news']),
 *   locale: oneOf(['fr', 'en'])
 * };
 * ```
 * <GENERATED_DIR>/params.ts, spread into the app's src/params.ts
 */
const paramsModule = (slugsByMatcher: Record<string, string[]>) => `
const oneOf =
  <const T extends string>(slugs: readonly T[]) =>
  (param: string): T | undefined =>
    (slugs as readonly string[]).includes(param) ? (param as T) : undefined;

export const params = {
${Object.entries(slugsByMatcher)
  .map(([name, slugs]) => `  ${name}: oneOf(${JSON.stringify(slugs)})`)
  .join(',\n')}
};
`;

/**
 * Catch-all so /api/* stays a literal, static-prefixed SvelteKit route —
 * without it, an unmatched /api/* request (unknown slug, wrong shape) would
 * fall through to the next candidate in the manifest, e.g. the public site's
 * (front)/[[locale=locale]]/[[id]] route, silently binding garbage params instead
 * of 404ing.
 * (rime)/api/[...rest]/+server.ts
 */
const apiCatchAllServer = () => `
import { error } from '@sveltejs/kit';

export const fallback = async () => {
  throw error(404);
};`;

/**
 * The file of a component compiled in dev mode. Svelte keeps it under its own
 * `Symbol('filename')`, which only its description can find.
 *
 * ```ts
 * import Stats from './Stats.svelte';
 * componentFilename(Stats); // 'src/+rime/Stats.svelte'
 * ```
 */
const componentFilename = (component: object): string | undefined => {
  const key = Object.getOwnPropertySymbols(component).find((s) => s.description === 'filename');
  return key ? (component as Record<symbol, string>)[key] : undefined;
};

/**
 * The `+page.svelte` of one `panel.routes` entry, written in `fromDir`: it imports the entry's
 * component by a path relative to `fromDir` and renders it with the page data. `component` is a
 * path from the project root, or a component compiled in dev mode, which carries its own file.
 *
 * ```ts
 * customRoute({ label: 'Stats', component: Stats }, '/site/src/routes/(rime)/[panel=panel]/stats');
 * // <script lang="ts">
 * //   import Page from '../../../../+rime/Stats.svelte'
 * //   const { data } = $props()
 * // </script>
 * // <Page {data} />
 * ```
 */
const customRoute = (
  config: CustomPanelRoute | { label: string; component: string },
  fromDir: string
): string => {
  const file =
    typeof config.component === 'string' ? config.component : componentFilename(config.component);
  if (!file) {
    logger.error(`panel.routes: the component of "${config.label}" has no file to import`);
    return 'Cannot find the file of this route component';
  }
  // A package's file goes through the project's own node_modules, not the versioned folder the
  // package manager stores it in, which an update deletes:
  // node_modules/.pnpm/@acme+stats@1.0.0/node_modules/@acme/stats/dist/Stats.svelte
  // -> node_modules/@acme/stats/dist/Stats.svelte
  const inPackage = file.split('node_modules/').at(-1)!;
  const target =
    inPackage === file
      ? path.resolve(process.cwd(), file)
      : path.resolve(process.cwd(), 'node_modules', inPackage);
  const specifier = relativeImportSpecifier(fromDir, target);
  return `<script lang="ts">
  import Page from '${specifier}'
  const { data } = $props()
</script>
<Page {data} />`;
};

// Shared routes dictionary
export const commonRoutes: Routes = {
  '(rime)': {
    layout: rootLayout,
    layoutServer: rootLayoutServer,
    error: error
  },
  '(rime)/[panel=panel]/sign-in': {
    'page@(rime)': signInPage,
    pageServer: signInPageServer
  },
  '(rime)/[panel=panel]/forgot-password': {
    'page@(rime)': forgotPasswordPage,
    pageServer: forgotPasswordPageServer
  },
  '(rime)/[panel=panel]/reset-password': {
    'page@(rime)': resetPasswordPage,
    pageServer: resetPasswordPageServer
  },
  '(rime)/[panel=panel]': {
    layout: panelLayout,
    layoutServer: panelLayoutServer,
    page: panelPage,
    pageServer: panelPageServer
  },
  '(rime)/[panel=panel]/live-edit': {
    'page@(rime)': livePage,
    pageServer: livePageServer
  },
  '(rime)/[panel=panel]/[slug=collection]': {
    page: collectionListPage,
    pageServer: collectionListPageServer
  },
  '(rime)/[panel=panel]/[slug=collection]/[id]': {
    page: collectionDocPage,
    pageServer: collectionDocPageServer
  },
  '(rime)/[panel=panel]/[slug=area]': {
    page: areaDocPage,
    pageServer: areaDocPageServer
  },
  '(rime)/api/[...rest]': {
    server: apiCatchAllServer
  }
};

export { customRoute, paramsModule, prototypeApiServer };

/** Every fixed route file as the templates write it: a template that changes regenerates them. */
export const templatesSurface = (): string =>
  [
    ...Object.entries(commonRoutes).flatMap(([pattern, files]) =>
      Object.entries(files).map(([type, render]) => `${pattern}/${type}:${render()}`)
    ),
    `params:${paramsModule({})}`
  ].join('\n');
