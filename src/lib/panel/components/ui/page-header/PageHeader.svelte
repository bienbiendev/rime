<script lang="ts">
  import { type Snippet } from 'svelte';
  import BreadCrumb from '../breadcrumb/BreadCrumb.svelte';

  type Props = {
    title?: Snippet;
    /** A line under the title: a count, a date. */
    meta?: Snippet;
    /** Under the meta line: a document's url. */
    aside?: Snippet;
    /** The toolbar under the title, its left side. */
    bottomLeft?: Snippet;
    topLeft?: Snippet;
    topRight?: Snippet;
  };
  const { bottomLeft, topRight, topLeft, title, meta, aside }: Props = $props();
</script>

<div class="rz-page-header__row rz-page-header__row-top">
  <div>
    {#if topLeft}
      {@render topLeft()}
    {:else}
      <BreadCrumb />
    {/if}
  </div>

  <div class="rz-page-header__top-right">
    {@render topRight?.()}
  </div>
</div>

{#if title || meta || aside}
  <div class="rz-page-header__head">
    {#if title}
      <h1 class="rz-page-header__title">{@render title()}</h1>
    {/if}
    {#if meta}
      <p class="rz-page-header__meta">{@render meta()}</p>
    {/if}
    {@render aside?.()}
  </div>
{/if}

{#if bottomLeft}
  <div class="rz-page-header__toolbar">
    <div class="rz-page-header__bottom-left">
      {@render bottomLeft?.()}
    </div>
  </div>
{/if}

<style type="postcss">
  @import '../../../style/mixins/index.css';

  /*
   * A bar over the page: the left column takes the free room, the right one sits at the end.
   */
  .rz-page-header__row-top {
    position: sticky;
    top: 0;
    z-index: 100;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--rz-size-4);
    align-items: center;
    height: var(--rz-size-11);
    margin-bottom: var(--rz-size-6);
    padding-inline: var(--rz-size-5) var(--rz-size-3);
    /* See-through, so the page's glow reaches the top; what scrolls under it blurs. */
    background: oklch(from var(--rz-bg-page) l c h / 0.8);
    backdrop-filter: blur(12px);
    box-shadow: inset 0 -1px 0 var(--rz-border);
  }

  /* Room above a title; without one, the page starts closer. */
  .rz-page-header__row-top:has(+ .rz-page-header__head) {
    margin-bottom: var(--rz-size-10);
  }

  .rz-page-header__row-top > div,
  .rz-page-header__bottom-left {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
  }

  .rz-page-header__top-right {
    display: flex;
    align-items: center;
    gap: var(--rz-size-1);
  }

  .rz-page-header__top-right {
    justify-content: flex-end;
  }

  /*
   * The title and the toolbar line up with a page's content. A page narrows it with
   * `--rz-page-width`; else it runs the full width, inside the gutter.
   */
  .rz-page-header__head,
  .rz-page-header__toolbar {
    padding-inline: max(
      var(--rz-page-gutter, var(--rz-size-6)),
      calc((100% - var(--rz-page-width, 100%)) / 2)
    );
  }

  .rz-page-header__head {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-1-5);
  }

  .rz-page-header__title {
    @mixin line-clamp 1;
    @mixin font-semibold;
    font-size: var(--rz-text-4xl);
    line-height: 1.15;
    letter-spacing: -0.03em;
  }

  .rz-page-header__meta {
    color: var(--rz-fg-subtle);
    font-variant-numeric: tabular-nums;
  }

  /* It stays under the breadcrumb row while the page scrolls. */
  .rz-page-header__toolbar {
    position: sticky;
    top: var(--rz-size-11);
    z-index: 100;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-2) var(--rz-size-4);
    padding-block: var(--rz-size-3);
    margin-top: var(--rz-size-2);
    background: var(--rz-bg-page);
  }

  .rz-page-header__bottom-left {
    flex: 1;
    flex-wrap: wrap;
    min-width: 0;
  }
</style>
