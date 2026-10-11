<script lang="ts">
  import type { CollectionDocData } from '#lib/panel/index.js';
  import DocumentPage from '../shared/DocumentPage.svelte';

  const { data }: { data: CollectionDocData } = $props();
</script>

<DocumentPage {data} operation={data.operation} class="rz-collection-container__doc" />
