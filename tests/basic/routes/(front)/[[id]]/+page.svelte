<script lang="ts">
  import LiveConsumer from '$lib/panel/components/sections/live/Consumer.svelte';
  let { data }: { data: { doc: PagesDoc } } = $props();
</script>

<LiveConsumer {data}>
  {#snippet child(doc)}
    <h1>{doc.attributes.title}</h1>
  {/snippet}
</LiveConsumer>

<style>
  h1 {
    font-size: 3rem;
  }
</style>
