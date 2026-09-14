<script lang="ts">
  import Document from '$lib/panel/components/sections/document/Document.svelte';
  import Versions from '$lib/panel/components/sections/document/Versions.svelte';
  import Page from '$lib/panel/components/sections/page-layout/Page.svelte';
  import Unauthorized from '$lib/panel/components/sections/unauthorized/Unauthorized.svelte';
  import { setVersionsContext } from '$lib/panel/context/versions.svelte.js';
  import type { AreaDocData } from '$lib/panel/index.js';

  const { data }: { data: AreaDocData } = $props();

  const versions = setVersionsContext();
</script>

{#if data.status === 200}
  <Page>
    {#snippet main()}
      {#key `${data.doc.id}|${data.doc.versionId ?? ''}|${data.doc.locale ?? ''}`}
        <Document doc={data.doc} readOnly={data.readOnly} operation="update" />
      {/key}
    {/snippet}
  </Page>
  <Versions doc={data.doc} bind:open={versions.open} versionId={versions.versionId} />
{:else}
  <Unauthorized />
{/if}
