<script lang="ts">
  import type { AreaDocData } from '#lib/panel/index.js';
  import DocumentPage from '../shared/DocumentPage.svelte';

  const { data }: { data: AreaDocData } = $props();
</script>

<DocumentPage {data} operation="update" />
