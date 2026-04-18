import { PACKAGE_NAME } from '$lib/core/constant.server.js';
import { TScastVersionSlug, type Routes } from './util.js';

/**
 * Layout server template for collection
 * (rime)/panel/{collection.kebab}/+page.server.ts
 */
const pageServer = (slug: string) => `
import { pagesLoad } from '${PACKAGE_NAME}/panel';
export const load = pagesLoad.collection.list('${slug}')
`;

/**
 * Page template for collection list
 * (rime)/panel/{collection.kebab}/+page.svelte
 */
const page = (slug: string) => `
<script>
  import { Collection } from '${PACKAGE_NAME}/panel/client'
  const { data } = $props()
</script>
<Collection {data} slug='${slug}' />`;

/**
 * Document page template
 * (rime)/panel/{collection.kebab}/[id]/+page.svelte
 */
const docPage = () => `
<script lang="ts">
	import { CollectionDoc, type CollectionDocData } from '${PACKAGE_NAME}/panel/client';
	const { data }: { data: CollectionDocData<false> } = $props();
</script>

<CollectionDoc {data} />`;

/**
 * Document page server template
 * (rime)/panel/{collection.kebab}/[id]/+page.server.ts
 * (rime)/panel/{collection.kebab}/[id]/versions/+page.server.ts
 * Same actions / load for /versions page
 * except the withVersion param
 */
const docPageServer = (slug: string) => `
import { pagesLoad, pagesActions } from '${PACKAGE_NAME}/panel'

export const load = pagesLoad.collection.doc('${slug}')
export const actions = pagesActions.collection.doc('${slug}')`;

const docPageServerVersions = (slug: string) => `
import { pagesLoad, pagesActions } from '${PACKAGE_NAME}/panel'

export const load = pagesLoad.collection.doc('${slug}', true)
export const actions = pagesActions.collection.doc('${slug}')`;

/**
 * Document page versions template
 * (rime)/panel/{collection.kebab}/[id]/versions/+page.svelte
 */
const docPageVersions = () => `
<script lang="ts">
	import { CollectionDocVersions, type CollectionDocData } from '${PACKAGE_NAME}/panel/client';
	const { data }: { data: CollectionDocData<true> } = $props();
</script>

<CollectionDocVersions {data} />`;

/**
 * API collection list operations
 * (rime)/api/{collection.kebab}/+server.ts
 */
const apiCollectionServer = (slug: string) => `
import * as api from '${PACKAGE_NAME}/api';

export const GET = api.collection.get(${TScastVersionSlug(slug)})
export const POST = api.collection.create(${TScastVersionSlug(slug)})
export const DELETE = api.collection.delete(${TScastVersionSlug(slug)})
`;

/**
 * API collection document operations
 * (rime)/api/{collection.kebab}/[id]/+server.ts
 */
const apiCollectionDocServer = (slug: string) => `
import * as api from '${PACKAGE_NAME}/api';

export const GET = api.collection.getById(${TScastVersionSlug(slug)})
export const PATCH = api.collection.updateById(${TScastVersionSlug(slug)})
export const DELETE = api.collection.deleteById(${TScastVersionSlug(slug)})
`;

/**
 * API collection document duplication
 * (rime)/api/{collection.kebab}/[id]/duplicate/+server.ts
 */
const apiCollectionDocDuplicateServer = (slug: string) => `
import * as api from '${PACKAGE_NAME}/api';

export const POST = api.collection.duplicate('${slug}')
`;

/****************************************************/
/* Routes
/****************************************************/

/**
 * Collection panel routes
 */
export const collectionPanelRoutes: Routes = {
  '(rime)/panel/{collection.kebab}/': {
    pageServer: pageServer,
    page: page
  },
  '(rime)/panel/{collection.kebab}/[id]': {
    page: docPage,
    pageServer: docPageServer
  }
};

/**
 * Collection verions panel routes
 */
export const collectionVersionsPanelRoutes: Routes = {
  '(rime)/panel/{collection.kebab}/[id]/versions': {
    page: docPageVersions,
    pageServer: docPageServerVersions
  }
};

/**
 * Collection API routes
 */
export const collectionAPIRoutes: Routes = {
  '(rime)/api/{collection.kebab}/': {
    server: apiCollectionServer
  },
  '(rime)/api/{collection.kebab}/[id]': {
    server: apiCollectionDocServer
  },
  '(rime)/api/{collection.kebab}/[id]/duplicate': {
    server: apiCollectionDocDuplicateServer
  }
};
