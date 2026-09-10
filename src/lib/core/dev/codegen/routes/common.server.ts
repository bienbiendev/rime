import { PACKAGE_NAME } from '$lib/core/constants.server.js';
import path from 'node:path';
import { configImportPaths } from '../../constants.server.js';
import type { Routes } from './util.server.js';

const PANEL_LAYOUT_DIR = path.resolve(process.cwd(), 'src/routes/(rime)/[panel=panel]');
const LIVE_PAGE_DIR = path.resolve(process.cwd(), 'src/routes/(rime)/[panel=panel]/live-edit');

/**
 * Main base layout
 * /+layout.server.ts
 */
const mainLayout = (): string => `
import { toPublicUser } from '${PACKAGE_NAME}/server';
import type { ServerLoadEvent } from '@sveltejs/kit';
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
 * (rime)/[panel=panel]/sign-in/+page.svelte
 */
const signInPage = () => `
<script>
  import { SignIn } from '${PACKAGE_NAME}/panel';
  const { data } = $props();
</script>

<SignIn {data} />`;

/**
 * Login page server template
 * (rime)/auth/sign-in/+page@(rime).server.ts
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
 * (rime)/[panel=panel]/forgot-password/+page.svelte
 */
const forgotPasswordPage = () => `
<script>
  import { ForgotPassword } from '${PACKAGE_NAME}/panel'
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
 * (rime)/[panel=panel]/reset-password/+page.svelte
 */
const resetPasswordPage = () => `
<script>
  import { ResetPassword } from '${PACKAGE_NAME}/panel';
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
 * (rime)/live/+page.svelte
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
 * (rime)/live/+page.server.ts
 */
const livePageServer = () => `
import { type ServerLoadEvent } from '@sveltejs/kit';

export const load = (event: ServerLoadEvent) => event.locals.routes.panel.load.live(event);`;

/****************************************************/
/* The panel's /[slug=<prototype>]/... routes — fixed, generic,
/* matcher-disambiguated, generated once regardless of how many prototypes of
/* that kind are configured. The per-prototype param matchers (src/params/,
/* see paramMatcher below) route each slug to the right folder at the
/* SvelteKit router level, so a collection page and an area page are
/* genuinely separate routes — no runtime kind-branching inside a shared
/* component, no unauthenticated-branch union fighting the component's data
/* prop type. Each reads slug/id off event.params (a real dynamic route
/* param) via event.locals.routes, so none of these import anything from
/* rimecms besides the panel components.
/*
/* These stay written out per kind while the panel does: its loads, actions
/* and components are per-kind too, so generating the routes from the
/* registry alone would move that seam rather than close it. The /api tree,
/* whose handlers a prototype now declares, is generated instead — see
/* prototypeApiServer below.
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
  return { ...data, slug: event.params.slug || '' };
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
 * Collection document versions page
 * (rime)/[panel=panel]/[slug=collection]/[id]/versions/+page.svelte
 */
const collectionDocVersionsPage = () => `
<script>
  import { CollectionDocVersions } from '${PACKAGE_NAME}/panel';
  const { data } = $props();
</script>

<CollectionDocVersions data={data} />`;

/**
 * (rime)/[panel=panel]/[slug=collection]/[id]/versions/+page.server.ts
 */
const collectionDocVersionsPageServer = () => `
import { type ServerLoadEvent } from '@sveltejs/kit';

export const load = (event: ServerLoadEvent) =>
  event.locals.routes.panel.load.documentVersions(event);`;

/**
 * Area document versions page
 * (rime)/[panel=panel]/[slug=area]/versions/+page.svelte
 */
const areaVersionsPage = () => `
<script>
  import { AreaVersionsDoc } from '${PACKAGE_NAME}/panel';
  const { data } = $props();
</script>

<AreaVersionsDoc data={data} />`;

/**
 * (rime)/[panel=panel]/[slug=area]/versions/+page.server.ts
 */
const areaVersionsPageServer = () => `
import { type ServerLoadEvent } from '@sveltejs/kit';

export const load = (event: ServerLoadEvent) => event.locals.routes.panel.load.areaVersions(event);`;

/**
 * A prototype's REST endpoint, one file per declared sub-path.
 *
 * There is no per-kind template any more: `name`, `path` and `methods` all come from what the
 * prototype declared in its own `rest/index.server.ts`, so an area's file has no POST for the
 * same reason an area has no create — nobody declared one. An undeclared method stays
 * unexported and SvelteKit answers it with its own 405, exactly as before.
 *
 * The body dispatches by name and path (see `rest` in handlers/routes.server.ts) so this file,
 * like every other generated route, imports nothing from rimecms.
 *
 * (rime)/api/[slug=<name>]/<path>/+server.ts
 */
const prototypeApiServer = (name: string, path: string, methods: string[]) => `
import { type RequestEvent } from '@sveltejs/kit';

const handle = (event: RequestEvent) => event.locals.routes.rest('${name}', '${path}', event);

${methods.map((method) => `export const ${method} = handle;`).join('\n')}`;

/**
 * Param matchers backing [slug=<prototype>] — bake in the actual configured
 * slug list at generation time so they stay isomorphic (no server-only config
 * import; SvelteKit resolves matchers on the client too for client-side
 * navigation), same approach as this repo's own hand-written
 * src/params/news.ts, lang.ts.
 *
 * One file per prototype name, named *after* that prototype — see the loop in
 * index.server.ts, where that naming is what makes `[slug=collection]` mean
 * "a slug of the collection prototype".
 * src/params/<prototype>.ts
 */
const paramMatcher = (slugs: string[]) => `
import type { ParamMatcher } from '@sveltejs/kit';

const slugs = ${JSON.stringify(slugs)} as const;

export const match: ParamMatcher = (param): param is (typeof slugs)[number] =>
  (slugs as readonly string[]).includes(param);`;

/**
 * Catch-all so /api/* stays a literal, static-prefixed SvelteKit route —
 * without it, an unmatched /api/* request (unknown slug, wrong shape) would
 * fall through to the next candidate in the manifest, e.g. the public site's
 * (front)/[[locale]]/[[id]] route, silently binding garbage params instead
 * of 404ing.
 * (rime)/api/[...rest]/+server.ts
 */
const apiCatchAllServer = () => `
import { error } from '@sveltejs/kit';

export const fallback = async () => {
  throw error(404);
};`;

/**
 * Custom route template generator
 * Used for generating custom routes
 */
const customRoute = (config: any): string => {
  let componentPath: string = '';
  let componentName: string = '';

  const rawPath =
    typeof config.component === 'string'
      ? config.component
      : config.component[Symbol.for('filename')] || (config.component as any)[Symbol('filename')];

  if (rawPath) {
    const componentReg = /([A-Z][a-zA-Z0-9]+)\.svelte$/;
    const match = rawPath.match(componentReg);
    if (match) {
      componentName = match[1];

      if (rawPath.includes('node_modules/')) {
        componentPath = 'node_modules/' + rawPath.split('node_modules/').at(-1);
      } else {
        componentPath = '$lib/' + rawPath.split('lib/').at(-1);
      }
    }
  }

  if (componentName && componentPath) {
    return `<script lang="ts">
  import ${componentName} from '${componentPath}'
  const { data } = $props()
</script>
<${componentName} {data} />`;
  }

  return `Cannot parse provided component path`;
};

// Shared routes dictionary
export const commonRoutes: Routes = {
  '': {
    layoutServer: mainLayout
  },
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
  '(rime)/[panel=panel]/[slug=collection]/[id]/versions': {
    page: collectionDocVersionsPage,
    pageServer: collectionDocVersionsPageServer
  },
  '(rime)/[panel=panel]/[slug=area]': {
    page: areaDocPage,
    pageServer: areaDocPageServer
  },
  '(rime)/[panel=panel]/[slug=area]/versions': {
    page: areaVersionsPage,
    pageServer: areaVersionsPageServer
  },
  '(rime)/api/[...rest]': {
    server: apiCatchAllServer
  }
};

export { customRoute, paramMatcher, prototypeApiServer };
