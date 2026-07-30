<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { setLiveContext } from '$lib/panel/context/live.svelte.js';
  import { onMount, type Snippet } from 'svelte';

  const { children }: { children: Snippet } = $props();

  let live = setLiveContext(page.url.href);
  beforeNavigate(live.beforeNavigate);

  onMount(() => {
    window.addEventListener('message', live.onMessage);
  });
</script>

{@render children()}
