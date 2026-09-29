<script lang="ts">
  import { LiveEdit, RenderRichText } from '$lib/public.js';

  let { data }: { data: { doc: NewsDoc } } = $props();
</script>

<LiveEdit data={data.doc}>
  {#snippet child(doc, props)}
    <div {...props}>
      {doc.attributes.title ? doc.attributes.title : 'No title'}
      <br />
      {#if doc.writer.text}
        <RenderRichText json={doc.writer.text} />
      {/if}
    </div>
  {/snippet}
</LiveEdit>
