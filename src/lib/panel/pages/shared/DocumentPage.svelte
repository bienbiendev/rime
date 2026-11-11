<script lang="ts">
  import Document from '#lib/panel/components/sections/document/Document.svelte';
  import Versions from '#lib/panel/components/sections/document/Versions.svelte';
  import Page from '#lib/panel/components/sections/page-layout/Page.svelte';
  import { setVersionsContext } from '#lib/panel/context/versions.svelte.js';
  import type { AreaDocData, CollectionDocData } from '#lib/panel/index.js';

  type Props = {
    data: AreaDocData | CollectionDocData;
    class?: string;
  };
  const { data, class: className }: Props = $props();

  const versions = setVersionsContext();
</script>

<!-- One document: its form, keyed on the row the page holds, and its versions history. -->
<Page>
  {#snippet main()}
    {#key `${data.doc.id}|${data.doc.versionId ?? ''}|${data.doc.locale ?? ''}|${versions.stamp}`}
      <Document
        class={className}
        doc={data.doc}
        operation={data.operation}
        readOnly={data.readOnly}
      />
    {/key}
  {/snippet}
</Page>
<Versions doc={data.doc} bind:open={versions.open} versionId={versions.versionId} />
