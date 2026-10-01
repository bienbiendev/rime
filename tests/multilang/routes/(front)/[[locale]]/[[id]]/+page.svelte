<script lang="ts">
  import { LiveEdit, Relation, RichText } from '$lib/public.js';

  let { data } = $props();
</script>

<LiveEdit data={data.doc}>
  {#snippet child(doc)}
    <LiveEdit path="attributes" data={doc.attributes}>
      {#snippet child(attributes, props)}
        <div {...props}>
          <h1>{attributes.title}</h1>
          {#await Relation.resolve(attributes.author).first() then author}
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
                <p>{RichText.toText(block.text)}</p>
              {:else if block.type === 'image'}
                {#await Relation.resolve(block.image).first() then image}
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
