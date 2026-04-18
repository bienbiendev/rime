<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    main: Snippet;
    aside?: Snippet;
  };
  const { main, aside }: Props = $props();
</script>

<div class="rz-page" class:rz-page-with-aside={aside}>
  <main>
    {@render main()}
  </main>

  {#if aside}
    <aside>
      {@render aside()}
    </aside>
  {/if}
</div>

<style>
  main {
    container: main / inline-size;
    --rz-page-gutter: var(--rz-size-20);
  }

  /* aside {
		margin-left: var(--rz-size-72);
	} */

  .rz-page-with-aside {
    display: grid;
    grid-template-columns: 1fr var(--rz-size-xs);
  }
</style>
