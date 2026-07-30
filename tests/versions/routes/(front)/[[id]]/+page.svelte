<script lang="ts">
  import LiveEdit from '$lib/panel/components/sections/live/LiveEdit.svelte';
  import { getLiveContext } from '$lib/panel/context/live.svelte';

  let { data }: { data: { doc: PagesDoc } } = $props();

  const liveCtx = getLiveContext();

  $effect(() => {
    liveCtx.doc = data.doc;
  });
</script>

<LiveEdit data={data.doc}>
  {#snippet child(doc)}
    <LiveEdit path="attributes.title" data={doc.attributes.title}>
      {#snippet child(title, props)}
        <h1 {...props}>{title}</h1>
      {/snippet}
    </LiveEdit>
  {/snippet}
</LiveEdit>

<style>
  :global(body) {
    background-color: white;
  }
  h1 {
    font-size: 3rem;
  }
</style>
