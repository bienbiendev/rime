<script lang="ts">
  import { LiveProvider } from '$lib/public.js';

  const { children } = $props();
</script>

<svelte:body />

<LiveProvider>
  {@render children()}
</LiveProvider>
