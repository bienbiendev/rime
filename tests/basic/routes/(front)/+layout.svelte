<script lang="ts">
  import LiveProvider from '$lib/panel/components/sections/live/Provider.svelte';

  const { children } = $props();
</script>

<svelte:body />

<LiveProvider>
  {@render children()}
</LiveProvider>
