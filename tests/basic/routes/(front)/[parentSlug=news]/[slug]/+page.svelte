<script lang="ts">
  import LiveEdit from '$lib/panel/components/sections/live/LiveEdit.svelte';

  let { data }: { data: { doc: NewsDoc } } = $props();
</script>

<LiveEdit data={data.doc}>
  {#snippet child(doc)}
    {doc.attributes.title}
    {#if doc.writer.text}
      {JSON.stringify(doc.writer.text)}
    {/if}
  {/snippet}
</LiveEdit>
