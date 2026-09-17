<script lang="ts">
  import type { BlockRenderProps } from '$lib/fields/types.js';
  import { RenderFields } from '$lib/panel/index.js';

  const { path, fields, form }: BlockRenderProps = $props();
  const text = $derived(fields.filter((field) => field.name === 'text'));
</script>

<!-- The rich text edited in place. -->
<div class="site-paragraph">
  <RenderFields fields={text} {path} {form} />
</div>

<style>
  .site-paragraph {
    color: rgb(200, 30, 30);
  }
</style>
