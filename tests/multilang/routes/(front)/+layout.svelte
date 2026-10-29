<script lang="ts">
  import { LiveProvider } from '#lib/public.js';

  const { children } = $props();
</script>

<LiveProvider>
  {@render children()}
</LiveProvider>
