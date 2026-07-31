<script lang="ts">
  import { isRelationResolved } from '$lib/fields/relation';
  import { richTextJSONToText } from '$lib/fields/rich-text';
  import LiveEdit from '$lib/panel/components/sections/live/LiveEdit.svelte';

  let { data }: { data: { doc: PagesDoc } } = $props();
</script>

<LiveEdit data={data.doc}>
  {#snippet child(doc)}
    <LiveEdit path="attributes.title" data={doc.attributes.title}>
      {#snippet child(title, props)}
        <h1 {...props}>{title}</h1>
      {/snippet}
    </LiveEdit>

    <LiveEdit path="attributes.summary" data={doc.attributes.summary}>
      {#snippet child(summary, props)}
        {@const thumbnail = summary.thumbnail?.at(0)}
        <div {...props}>
          {#if isRelationResolved(thumbnail)}
            <img alt="" style="width:100%;height:auto;" src={(thumbnail as MediasDoc).sizes.lg} />
          {/if}
          {#if summary.intro}
            <p>{richTextJSONToText(summary.intro)}</p>
          {/if}
        </div>
      {/snippet}
    </LiveEdit>

    <div class="blocks">
      {#each doc.layout.sections as block, index (block.id)}
        <LiveEdit path="layout.sections.{index}:{block.type}" data={block}>
          {#snippet child(block, props)}
            <div {...props}>
              {#if block.type === 'paragraph'}
                <p>{richTextJSONToText(block.text)}</p>
              {:else if block.type === 'image'}
                {@const image = block.image?.at(0)}
                {#if isRelationResolved<MediasDoc>(image)}
                  <img alt="" style="width:100%;height:auto;" src={image.sizes.lg} />
                {/if}
              {/if}
            </div>
          {/snippet}
        </LiveEdit>
      {/each}
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
