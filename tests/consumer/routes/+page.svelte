<!-- The consumer app's front page, built from rimecms/public only: its chunks carry no panel. -->
<script lang="ts">
  import { openSse, RenderRichText, type JSONContent } from 'rimecms/public';

  const text: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A site page' }] }]
  };
</script>

<RenderRichText json={text} />
<button onclick={() => openSse('public:site', () => {})}>Listen</button>
