<script lang="ts">
  import type { RelationFieldBuilder } from '$lib/fields/relation/index.js';
  import type { BlockRenderProps } from '$lib/fields/types.js';
  import { RelationInline } from '$lib/panel/index.js';

  const { path, fields, form }: BlockRenderProps = $props();
  const images = $derived(fields.find((field) => field.name === 'images') as RelationFieldBuilder);
</script>

<!-- Many medias in a grid, picked where they are drawn. -->
<RelationInline path="{path}.images" config={images} {form}>
  {#snippet children({ docs })}
    <div class="site-gallery">
      {#each docs as doc (doc.id)}
        <img src={doc.sizes?.md ?? doc.url} alt={doc.alt ?? ''} />
      {/each}
    </div>
  {/snippet}
</RelationInline>

<style>
  :global(.site-gallery) {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  :global(.site-gallery img) {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
  }
</style>
