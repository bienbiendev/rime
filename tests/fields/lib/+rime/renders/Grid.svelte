<script lang="ts">
  import type { BlockRenderProps } from '$lib/fields/types.js';

  const { block, children }: BlockRenderProps = $props();
</script>

<!-- The nested items drawn where the render puts them. -->
<section class="site-grid">
  <h2 class="site-grid__title">{block.title || 'Grid'}</h2>
  <div class="site-grid__items">{@render children?.()}</div>
</section>

<style>
  .site-grid {
    display: grid;
    gap: 12px;
    padding: 12px;
    border: 1px solid rgb(30, 30, 200);
  }

  .site-grid__title {
    color: rgb(30, 30, 200);
  }
</style>
