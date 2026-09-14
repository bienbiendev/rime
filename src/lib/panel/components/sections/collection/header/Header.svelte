<script lang="ts">
  import { getCollectionContext } from '$lib/panel/context/collection.svelte.js';
  import DisplayMode from './DisplayMode.svelte';
  import SelectUI from './SelectUI.svelte';
  import Separator from './Separator.svelte';

  const collection = getCollectionContext();
  const showSelectUI = $derived(!collection.isNested());
</script>

<Separator />
<DisplayMode />

{#if showSelectUI}
  <Separator />
  <SelectUI />
{/if}
