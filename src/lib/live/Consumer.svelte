<script lang="ts" generics="T">
  import { getLiveContext } from './context.svelte.js';
  import type { WithRelationResolved } from '$lib/core/fields/types.js';
  import type { Snippet } from 'svelte';

  let { child, data } = $props<{
    child: Snippet<[doc: WithRelationResolved<T>]>;
    data: { doc: T };
  }>();

  const live = getLiveContext();

  $effect(() => {
    if (live.enabled) {
      live.doc = data.doc;
    }
  });

  const doc = $derived(live.doc || data.doc) as WithRelationResolved<T>;
</script>

{@render child(doc)}
