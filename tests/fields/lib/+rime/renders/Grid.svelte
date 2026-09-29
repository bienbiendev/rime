<script lang="ts">
  import type { TextFieldBuilder } from '$lib/fields/text/index.js';
  import type { BlockRenderProps } from '$lib/fields/types.js';
  import { TextInline } from '$lib/panel/index.js';

  const { path, fields, form, children }: BlockRenderProps = $props();
  const title = $derived(fields.find((field) => field.name === 'title') as TextFieldBuilder);
</script>

<!-- The title edited where it is drawn, the nested items where the render puts them. -->
<section class="site-grid">
  <TextInline as="h2" path="{path}.title" config={title} {form} class="site-grid__title" />
  <div class="site-grid__items">{@render children?.()}</div>
</section>

<style>
  .site-grid {
    display: grid;
    gap: 12px;
    padding: 12px;
    border: 1px solid rgb(30, 30, 200);
  }

  :global(.site-grid__title) {
    color: rgb(30, 30, 200);
  }
</style>
