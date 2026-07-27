<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { env } from '$env/dynamic/public';
  import { setLiveContext } from '$lib/panel/context/live.svelte.js';
  import { onMount } from 'svelte';

  const origin = new URL(env.PUBLIC_RIME_URL).origin;
  let live = setLiveContext(page.url.href, origin);
  beforeNavigate(live.beforeNavigate);

  const { children } = $props();

  onMount(() => {
    window.addEventListener('message', live.onMessage);
  });
</script>

{@render children()}
