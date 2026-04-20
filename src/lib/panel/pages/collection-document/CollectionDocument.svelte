<script lang="ts">
  import Document from '$lib/panel/components/sections/document/Document.svelte';
  import Page from '$lib/panel/components/sections/page-layout/Page.svelte';
  import Unauthorized from '$lib/panel/components/sections/unauthorized/Unauthorized.svelte';
  import type { CollectionDocData } from '$lib/panel/index.js';

  const { data }: { data: CollectionDocData<false> } = $props();
</script>

{#if data.status === 200}
  <Page>
    {#snippet main()}
      {#key data.doc.id + data.doc.versionId || '' + data.doc.locale || ''}
        <Document
          class="rz-collection-container__doc"
          doc={data.doc}
          operation={data.operation}
          readOnly={data.readOnly}
        />
      {/key}
    {/snippet}
  </Page>
{:else}
  <Unauthorized />
{/if}
