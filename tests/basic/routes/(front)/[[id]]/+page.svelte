<script lang="ts">
  import { LiveEdit, Relation, RichText } from '$lib/public.js';

  let { data } = $props();
</script>

<LiveEdit>
  {#snippet child(doc: PagesDoc)}
    <LiveEdit path="attributes.title" data={doc.attributes.title}>
      {#snippet child(title, props)}
        <h1 {...props}>{title}</h1>
      {/snippet}
    </LiveEdit>

    <LiveEdit path="maintenance" update="/settings" data={data.settings.maintenance}>
      {#snippet child(maintenance, props)}
        <p {...props}>{maintenance ? 'Enabled' : 'Disabled'}</p>
      {/snippet}
    </LiveEdit>

    <LiveEdit path="attributes.summary" data={doc.attributes.summary}>
      {#snippet child(summary, props)}
        <div {...props}>
          {#await Relation.resolve(summary.thumbnail).first() then thumbnail}
            {#if thumbnail}
              <img alt="" style="width:100%;height:auto;" src={thumbnail.sizes.lg} />
            {/if}
          {/await}
          {#if summary.intro}
            <p>{RichText.toText(summary.intro)}</p>
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
                <p>{RichText.toText(block.text)}</p>
              {:else if block.type === 'image'}
                {#await Relation.resolve(block.image).first() then image}
                  {#if image}
                    <img alt="" style="width:100%;height:auto;" src={image.sizes.lg} />
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
