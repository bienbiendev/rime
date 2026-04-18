<script lang="ts">
  import LiveConsumer from '$lib/panel/components/sections/live/Consumer.svelte';

  let { data } = $props();
</script>

<LiveConsumer {data}>
  {#snippet child(doc)}
    {/* @ts-ignore */ null}
    {doc.instagram}
  {/snippet}
</LiveConsumer>
