<script lang="ts" generics="T">
  // A LiveEdit for a whole document that is not the page's own: an area, or another
  // collection's document shown on the page. It edits that document through its own API path.
  //
  //   <LiveConsumer data={{ doc: data.infos }}>
  //     {#snippet child(infos)}<footer>{infos.instagram}</footer>{/snippet}
  //   </LiveConsumer>
  import type { WithRelationResolved } from '#lib/core/fields/types.js';
  import type { GenericDoc } from '#lib/core/prototype/types.js';
  import type { Snippet } from 'svelte';
  import { updateURI } from './context.svelte.js';
  import LiveEdit from './LiveEdit.svelte';

  let { child: render, data } = $props<{
    child: Snippet<[doc: WithRelationResolved<T>]>;
    data: { doc: T };
  }>();
</script>

<LiveEdit data={data.doc} update={updateURI(data.doc as GenericDoc)}>
  {#snippet child(doc)}
    {@render render(doc as WithRelationResolved<T>)}
  {/snippet}
</LiveEdit>
