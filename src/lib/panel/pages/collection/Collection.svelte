<script lang="ts">
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import type { ComponentProps } from 'svelte';
  import CollectionPage from './CollectionPage.svelte';

  type Props = ComponentProps<typeof CollectionPage>;
  const { data, slug }: Props = $props();

  const locale = getLocaleContext();

  /**
   * One listing per collection, locale and upload folder.
   *
   * A new key drops the listing's own state — selection, sort, display mode — which belongs to
   * the listing it was made in. A reload with the same three updates in place.
   */
  const key = $derived(`${slug}|${locale.code ?? ''}|${data.upload?.currentPath ?? ''}`);
</script>

{#key key}
  <CollectionPage {data} {slug} />
{/key}
