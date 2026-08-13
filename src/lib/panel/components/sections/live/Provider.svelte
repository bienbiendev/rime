<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { setAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import { setLiveContext } from '$lib/panel/context/live.svelte.js';
  import { onMount, type Snippet } from 'svelte';

  const { children }: { children: Snippet } = $props();

  // Needed by rich-text features (e.g. link's page search) when live-editing in place.
  setAPIProxyContext();

  let live = setLiveContext(page.url.href);
  beforeNavigate(live.beforeNavigate);

  onMount(() => {
    window.addEventListener('message', live.onMessage);
  });
</script>

{@render children()}
