<!-- A custom node for render-rich-text.spec.ts: it writes the keys of the `components` it gets. -->
<script lang="ts">
  import type { RichTextNodeRendererProps } from './types';

  const { components }: RichTextNodeRendererProps = $props();
</script>

<aside>{Object.keys(components ?? {}).join(',')}</aside>
