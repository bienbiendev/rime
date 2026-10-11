<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    main: Snippet;
  };
  const { main }: Props = $props();
</script>

<div class="rz-page">
  <main>
    {@render main()}
  </main>
</div>

<style>
  main {
    container: main / inline-size;
    --rz-page-gutter: var(--rz-size-4);
  }

  @media (min-width: 640px) {
    main {
      --rz-page-gutter: var(--rz-size-8);
    }
  }

  @media (min-width: 960px) {
    main {
      --rz-page-gutter: var(--rz-size-20);
    }
  }
</style>
