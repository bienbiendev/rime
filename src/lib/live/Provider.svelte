<script lang="ts">
  // Makes a page live-editable: it answers the panel's handshake with the page's URL, takes the
  // values the panel sends, and, while in live view, hands every navigation to the panel.
  // It wraps the site's layout once; every LiveEdit and LiveConsumer below reads it.
  import { beforeNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { setLiveContext } from './context.svelte.js';
  import { onMount, type Snippet } from 'svelte';

  const { children }: { children: Snippet } = $props();

  const live = setLiveContext(page.url.href);
  beforeNavigate(live.beforeNavigate);

  onMount(() => {
    window.addEventListener('message', live.onMessage);
    return () => window.removeEventListener('message', live.onMessage);
  });
</script>

{@render children()}
