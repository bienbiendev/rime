<script lang="ts">
  import type { BuiltCollection } from '#lib/core/config/types.js';
  import { t__ } from '#lib/core/i18n/index.js';
  import type { GenericDoc } from '#lib/core/prototype/types.js';
  import { panelUrl } from '#lib/core/routes/util.js';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import { getAPIProxyContext } from '#lib/panel/context/api-proxy.svelte.js';
  import { pageURL, useCount } from '#lib/panel/util/candidates.svelte.js';
  import { titleOrUntitled } from '#lib/panel/util/title.js';

  type Props = { config: BuiltCollection; id: string };
  const { config, id }: Props = $props();

  const APIProxy = getAPIProxyContext();

  /** The children each step reads: the first ones, then each "Load more". */
  const STEP = 20;

  /** The pages whose parent this is. */
  const where = $derived({ config, query: `where[_parent][equals]=${id}` });
  /** How many steps are shown. */
  let steps = $state(1);

  // Through the API proxy: each write's `invalidate(apiUrl(kebab))` reads them again.
  const reads = $derived(
    Array.from({ length: steps }, (_, step) =>
      APIProxy.getRessource<{ docs: GenericDoc[] }>(
        pageURL(where, { sort: '_position', limit: STEP, offset: step * STEP })
      )
    )
  );
  const total = useCount(() => ({ open: true, ...where }));

  /** The children read so far, in order, each once: a write between two steps may shift one. */
  const children = $derived(
    reads
      .flatMap((read) => read.data?.docs ?? [])
      .filter((doc, index, all) => all.findIndex((other) => other.id === doc.id) === index)
  );
  const count = $derived(total.count ?? children.length);
  const left = $derived(Math.max(count - children.length, 0));
  const loading = $derived(reads.some((read) => read.isLoading));

  /** The path part of a child's url, or its path when it has no url. */
  const pathOf = (doc: GenericDoc) => {
    try {
      return new URL(String(doc.url)).pathname;
    } catch {
      return doc._urlPath ? `/${doc._urlPath}` : '';
    }
  };
</script>

{#if children.length}
  <section class="rz-document-children" aria-labelledby="rz-document-children-title">
    <header class="rz-document-children__head">
      <h2 class="rz-document-children__title" id="rz-document-children-title">
        {t__('common.under_this_page')}
        <span class="rz-document-children__count">{count}</span>
      </h2>
    </header>

    <div class="rz-document-children__list">
      {#each children as child (child.id)}
        <a class="rz-document-children__row" href={panelUrl(config.kebab, child.id)}>
          <span class="rz-document-children__name">{titleOrUntitled(child.title)}</span>
          <span class="rz-document-children__path">{pathOf(child)}</span>
        </a>
      {/each}
    </div>

    {#if left > 0}
      <Button
        class="rz-document-children__more"
        variant="ghost"
        size="sm"
        disabled={loading}
        onclick={() => steps++}
      >
        {t__('common.load_more', String(Math.min(left, STEP)), String(left))}
      </Button>
    {/if}
  </section>
{/if}

<style type="postcss">
  @import '../../../style/mixins/index.css';

  /* After the form and its tabs, the pages under this one, in the document's column. */
  .rz-document-children {
    display: grid;
    gap: var(--rz-size-3);
    padding-block: var(--rz-size-6) var(--rz-size-10);
    padding-inline: max(var(--rz-page-gutter), calc((100% - var(--rz-page-width)) / 2));
    border-top: 1px solid var(--rz-border);
  }

  .rz-document-children__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--rz-size-2);
  }

  .rz-document-children__title {
    @mixin font-medium;
    display: flex;
    align-items: baseline;
    gap: var(--rz-size-2);
    font-size: var(--rz-text-sm);
  }

  .rz-document-children__count {
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-xs);
    font-variant-numeric: tabular-nums;
  }

  .rz-document-children :global(.rz-document-children__more) {
    justify-self: center;
  }

  .rz-document-children__list {
    @mixin surface raised;
    display: grid;
    overflow: hidden;
    border-radius: var(--rz-radius-lg);
  }

  .rz-document-children__row {
    display: flex;
    align-items: center;
    gap: var(--rz-size-3);
    height: var(--rz-size-10);
    padding-inline: var(--rz-size-3-5);
    color: var(--rz-fg);
    text-decoration: none;

    & + & {
      box-shadow: inset 0 1px 0 var(--rz-border);
    }

    &:hover {
      background: var(--rz-bg-hover);
    }
  }

  .rz-document-children__name {
    flex: none;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rz-document-children__path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--rz-fg-subtle);
    font-family: var(--rz-font-mono);
    font-size: var(--rz-text-xs);
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
