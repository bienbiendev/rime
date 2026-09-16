<script lang="ts">
  import { richTextJSONToText } from '$lib/fields/rich-text/client.js';
  import type { BlockRenderProps } from '$lib/fields/types.js';

  const { block }: BlockRenderProps = $props();
</script>

<p class="site-paragraph">{richTextJSONToText(block.text)}</p>

<style>
  .site-paragraph {
    color: rgb(200, 30, 30);
  }
</style>
