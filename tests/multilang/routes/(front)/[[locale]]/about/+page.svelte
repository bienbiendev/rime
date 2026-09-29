<script lang="ts">
  import { LiveConsumer } from '$lib/public.js';

  let { data } = $props();
</script>

<LiveConsumer {data}>
  {#snippet child(doc)}
    {/* @ts-ignore */ null}
    {doc.instagram}
  {/snippet}
</LiveConsumer>
