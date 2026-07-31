<script lang="ts">
  import { resolveRelation } from '$lib/fields/relation';
  import { richTextJSONToText } from '$lib/fields/rich-text';
  import LiveEdit from '$lib/panel/components/sections/live/LiveEdit.svelte';

  let { data } = $props();
</script>

<LiveEdit data={data.doc}>
  {#snippet child(doc)}
    <LiveEdit path="attributes" data={doc.attributes}>
      {#snippet child(attributes, props)}
        <div {...props}>
          <h1>{attributes.title}</h1>
          {#await resolveRelation(attributes.author).then((r) => r?.at(0)) then author}
            {#if author}
              <p>{author.email}</p>
            {/if}
          {/await}
        </div>
      {/snippet}
    </LiveEdit>

    <div class="blocks">
      {#each doc.layout.components as block, index (block.id)}
        <LiveEdit path="layout.components.{index}:{block.type}" data={block}>
          {#snippet child(block, props)}
            <div {...props}>
              {#if block.type === 'paragraph'}
                <p>{richTextJSONToText(block.text)}</p>
              {:else if block.type === 'image'}
                {#await resolveRelation(block.image).then((r) => r?.at(0)) then image}
                  {#if image}
                    <img alt="" style="width:100%;height:auto;" src={image.sizes.large} />
                  {/if}
                {/await}
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
