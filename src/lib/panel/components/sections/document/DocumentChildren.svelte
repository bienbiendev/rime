<script lang="ts">
  import type { BuiltCollection } from '$lib/core/config/types';
  import { PARAMS } from '$lib/core/constants.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import type { GenericDoc } from '$lib/core/prototype/types';
  import { apiUrl, panelUrl } from '$lib/core/routes/util.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';

  type Props = { config: BuiltCollection; id: string };
  const { config, id }: Props = $props();

  const locale = getLocaleContext();

  /** The first ones: past that, the collection's list. */
  const LIMIT = 20;

  let children = $state<GenericDoc[]>([]);
  let more = $state(false);

  // One query: the pages whose parent this is, with their addresses.
  $effect(() => {
    const params = new URLSearchParams({
      'where[_parent][equals]': id,
      sort: '_position',
      limit: String(LIMIT + 1)
    });
    if (locale.code) params.set(PARAMS.LOCALE, locale.code);

    let cancelled = false;
    fetch(`${apiUrl(config.kebab)}?${params}`)
      .then((response) => (response.ok ? response.json() : { docs: [] }))
      .then(({ docs }: { docs: GenericDoc[] }) => {
        if (cancelled) return;
        more = docs.length > LIMIT;
        children = docs.slice(0, LIMIT);
      })
      .catch(() => {});
    return () => (cancelled = true);
  });

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
        <span class="rz-document-children__count">{more ? `${LIMIT}+` : children.length}</span>
      </h2>
      {#if more}
        <a class="rz-document-children__all" href={panelUrl(config.kebab)}
          >{t__('common.view_all')}</a
        >
      {/if}
    </header>

    <div class="rz-document-children__list">
      {#each children as child (child.id)}
        <a class="rz-document-children__row" href={panelUrl(config.kebab, child.id)}>
          <span class="rz-document-children__name">{child.title || t__('common.untitled')}</span>
          <span class="rz-document-children__path">{pathOf(child)}</span>
        </a>
      {/each}
    </div>
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

  .rz-document-children__all {
    color: var(--rz-accent-text);
    font-size: var(--rz-text-xs);
    text-decoration: none;
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
