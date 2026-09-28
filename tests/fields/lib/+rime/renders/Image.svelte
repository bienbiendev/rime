<script lang="ts">
  import type { RelationFieldBuilder } from '$lib/fields/relation/index.js';
  import type { BlockRenderProps } from '$lib/fields/types.js';
  import { RelationInline } from '$lib/panel/index.js';

  const { path, fields, form }: BlockRenderProps = $props();
  const image = $derived(fields.find((field) => field.name === 'image') as RelationFieldBuilder);
</script>

<!-- One media, picked where it is drawn. -->
<RelationInline path="{path}.image" config={image} {form}>
  {#snippet children({ docs })}
    <img class="site-image" src={docs[0].sizes?.md ?? docs[0].url} alt={docs[0].alt ?? ''} />
  {/snippet}
</RelationInline>

<style>
  :global(.site-image) {
    display: block;
    width: 100%;
    height: auto;
  }
</style>
