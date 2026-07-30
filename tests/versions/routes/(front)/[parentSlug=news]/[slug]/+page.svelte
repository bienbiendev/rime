<script lang="ts">
  import RenderRichText from '$lib/fields/rich-text/core/render-rich-text.svelte';
  import LiveEdit from '$lib/panel/components/sections/live/LiveEdit.svelte';

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
