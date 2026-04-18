import { PACKAGE_NAME } from '$lib/core/constant.server.js';
import { TScastVersionSlug, type Routes } from './util.js';

/**
 * Area templates defined outside of the routes object
 * (rime)/panel/{area.kebab}/+page.svelte
 */
const pageTemplate = (): string => `
<script>
  import { Area } from '${PACKAGE_NAME}/panel/client'
  const { data } = $props()
</script>
<Area {data} />`;

/**
 * Page server template for area
 * (rime)/panel/{area.kebab}/+page.server.ts
 */
const pageServerTemplate = (slug: string): string => `
import { pagesLoad, pagesActions } from '${PACKAGE_NAME}/panel'

export const load = pagesLoad.area('${slug}')
export const actions = pagesActions.area('${slug}')
`;

const pageServerTemplateVersions = (slug: string): string => `
import { pagesLoad, pagesActions } from '${PACKAGE_NAME}/panel'

export const load = pagesLoad.area('${slug}', true)
export const actions = pagesActions.area('${slug}')
`;

/**
 * API collection list operations
 * (rime)/api/{collection.slug}/+server.ts
 */
const apiAreaServer = (slug: string): string => `
import * as api from '${PACKAGE_NAME}/api';

export const GET = api.area.get(${TScastVersionSlug(slug)})
export const PATCH = api.area.update(${TScastVersionSlug(slug)})
`;

/**
 * Document page versions template
 * (rime)/panel/{collection.slug}/[id]/versions/+page.svelte
 */
const pageVersions = () => `
<script lang="ts">
	import { AreaVersionsDoc, type AreaDocData } from '${PACKAGE_NAME}/panel/client';
	const { data }: { data: AreaDocData<true> } = $props();
</script>

<AreaVersionsDoc {data} />`;

/**
 * Area routes dictionary defining route patterns and their corresponding templates
 */
export const areaRoutes: Routes = {
  '(rime)/panel/{area.kebab}/': {
    page: pageTemplate,
    pageServer: pageServerTemplate
  }
};

export const areaVersionsPanelRoutes: Routes = {
  '(rime)/panel/{area.kebab}/versions': {
    page: pageVersions,
    pageServer: pageServerTemplateVersions
  }
};

export const areaAPIRoutes: Routes = {
  '(rime)/api/{area.kebab}/': {
    server: apiAreaServer
  }
};
