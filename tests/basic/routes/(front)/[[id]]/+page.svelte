<script lang="ts">
  import { isRelationResolved } from '$lib/fields/relation';
  import { richTextJSONToText } from '$lib/fields/rich-text';
  import LiveEdit from '$lib/panel/components/sections/live/LiveEdit.svelte';
  let { data }: { data: { doc: PagesDoc } } = $props();
</script>

<LiveEdit path="attributes.title" update="pages/{data.doc.id}" data={data.doc.attributes.title}>
  {#snippet child(title, props)}
    <h1 {...props}>{title}</h1>
  {/snippet}
</LiveEdit>

<LiveEdit path="attributes.summary" update="pages/{data.doc.id}" data={data.doc.attributes.summary}>
  {#snippet child(summary, props)}
    {@const thumbnail = summary.thumbnail?.at(0)}
    <div {...props}>
      {#if isRelationResolved(thumbnail)}
        <img style="width:100%;height:auto;" src={(thumbnail as MediasDoc).sizes.lg} />
      {/if}
      {#if summary.intro}
        <p>{richTextJSONToText(summary.intro)}</p>
      {/if}
    </div>
  {/snippet}
</LiveEdit>

<style>
  :global(body) {
    background-color: white;
  }
  h1 {
    font-size: 3rem;
  }
</style>
