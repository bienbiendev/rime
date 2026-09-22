<script lang="ts">
  import type { RichTextFieldBuilder } from '$lib/fields/rich-text/index.js';
  import type { BlockRenderProps } from '$lib/fields/types.js';
  import { RichTextInline } from '$lib/panel/index.js';

  const { path, fields, form }: BlockRenderProps = $props();
  const text = $derived(fields.find((field) => field.name === 'text') as RichTextFieldBuilder);
</script>

<!-- The rich text edited in place, in the site's colour. -->
<RichTextInline path="{path}.text" config={text} {form} class="site-paragraph" />

<style>
  :global(.site-paragraph) {
    color: rgb(200, 30, 30);
  }
</style>
