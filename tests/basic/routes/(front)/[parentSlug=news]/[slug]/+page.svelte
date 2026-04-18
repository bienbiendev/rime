<script lang="ts">
  import LiveConsumer from '$lib/panel/components/sections/live/Consumer.svelte';

  let { data }: { data: { doc: NewsDoc } } = $props();
</script>

<LiveConsumer {data}>
  {#snippet child(doc)}
    {doc.attributes.title}
    {#if doc.writer.text}
      {JSON.stringify(doc.writer.text)}
    {/if}
  {/snippet}
</LiveConsumer>
