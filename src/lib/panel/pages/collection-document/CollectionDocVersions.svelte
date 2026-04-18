<script lang="ts">
  import type { VersionsStatus } from '$lib/core/constant.js';
  import type { VersionDoc } from '$lib/core/types/doc.js';
  import Document from '$lib/panel/components/sections/document/Document.svelte';
  import Versions from '$lib/panel/components/sections/document/Versions.svelte';
  import Page from '$lib/panel/components/sections/page-layout/Page.svelte';
  import Unauthorized from '$lib/panel/components/sections/unauthorized/Unauthorized.svelte';
  import { API_PROXY, setAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import type { CollectionDocData } from '$lib/panel/index.js';

  const { data }: { data: CollectionDocData<true> } = $props();

  setAPIProxyContext(API_PROXY.DOCUMENT);
</script>

{#if data.status === 200}
  {#key data.doc.id + data.doc.versionId || '' + data.doc.locale || ''}
    <Page>
      {#snippet main()}
        <Document
          class="rz-collection-container__doc"
          doc={data.doc}
          operation={data.operation}
          readOnly={data.readOnly}
        />
      {/snippet}
      {#snippet aside()}
        <Versions doc={data.doc} versions={data.versions} />
      {/snippet}
    </Page>
  {/key}
{:else}
  <Unauthorized />
{/if}
