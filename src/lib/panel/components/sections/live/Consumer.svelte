<script lang="ts" generics="T">
  import { getLiveContext } from '$lib/panel/context/live.svelte.js';
  import type { WithRelationPopulated } from '$lib/util/types';
  import type { Snippet } from 'svelte';

  let { child, data } = $props<{
    child: Snippet<[doc: WithRelationPopulated<T>]>;
    data: { doc: T };
  }>();

  const live = getLiveContext();

  $effect(() => {
    if (live.enabled) {
      live.doc = data.doc;
    }
  });

  const doc = $derived(live.doc || data.doc) as WithRelationPopulated<T>;
</script>

{@render child(doc)}
