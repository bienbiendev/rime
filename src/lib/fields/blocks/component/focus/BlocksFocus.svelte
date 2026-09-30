<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import CommandButton from '$lib/panel/components/sections/commands/CommandButton.svelte';
  import ButtonSave from '$lib/panel/components/sections/document/ButtonSave.svelte';
  import { Button } from '$lib/panel/components/ui/button/index.js';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import * as Sheet from '$lib/panel/components/ui/sheet/index.js';
  import * as Tabs from '$lib/panel/components/ui/tabs/index.js';
  import { useCommands } from '$lib/panel/context/commands.svelte.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { getNavContext } from '$lib/panel/context/nav.svelte.js';
  import { populate } from '$lib/fields/relation/populate.js';
  import { capitalize } from '$lib/util/string.js';
  import { ChevronRight, PanelRight, ToyBrick, X } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import BlockPicker from '../picker/BlockPicker.svelte';
  import { getBlocksFocusContext, type SidebarTab } from './focus.svelte.js';
  import Layers from './Layers.svelte';
  import Palette from './Palette.svelte';
  import Inspector from './Inspector.svelte';
  import Renders from './Renders.svelte';

  const { form }: { form: DocumentFormContext } = $props();

  const focus = getBlocksFocusContext()!;
  const locale = getLocaleContext();
  /** The overlay starts where the navigation ends, folded or not. */
  const nav = getNavContext();

  /** The list on screen: the open one, or the one the narrowed block sits in. */
  const stageList = $derived(focus.narrowedRow?.list ?? focus.path ?? '');
  const builder = $derived(stageList ? form.blocks.builder(stageList) : undefined);
  /** The types of the list the next insert goes to. */
  const addable = $derived.by(() => {
    const list = focus.insertList();
    return list ? (form.blocks.builder(list)?.get.blocks ?? []) : [];
  });
  const crumbs = $derived(focus.breadcrumb());
  /** The open list's blocks, or those the narrowed block holds. */
  const count = $derived(
    focus.narrowedRow
      ? focus.narrowedRow.children.reduce(
          (sum, child) => sum + form.blocks.list(child.list).length,
          0
        )
      : focus.path
        ? form.blocks.list(focus.path).length
        : 0
  );
  const countLabel = $derived(
    count === 1 ? t__('fields.blocks_count', '1') : t__('fields.blocks_count|m|p', String(count))
  );

  let confirmRemove = $state(false);

  /**
   * Under 52rem the panel leaves its column for a sheet, behind a button in the header. The
   * width is the overlay's own, which starts after the nav; the stylesheet's container query
   * reads the same one.
   */
  let width = $state(0);
  const narrow = $derived(width > 0 && width < 52 * remPx());
  let panelOpen = $state(false);

  function remPx() {
    return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  }

  // The selection moved. Nothing left to inspect: the types to add. Picked from the layers in the
  // sheet: put it away, to see the block.
  $effect(() => {
    const picked = !!focus.current;
    untrack(() => {
      if (focus.tab === 'inspector' && !picked) focus.tab = 'add';
      if (focus.tab === 'layers') panelOpen = false;
    });
  });

  // Arriving on an empty list: the types to add.
  $effect(() => {
    const opened = focus.path;
    untrack(() => {
      if (opened && !focus.locked && !count) focus.tab = 'add';
    });
  });

  // Asked to show a block's fields: the sheet opens on them.
  $effect(() => {
    if (!focus.inspected) return;
    untrack(() => {
      if (narrow) panelOpen = true;
    });
  });

  // A focus session starts with fresh relations in the renders.
  populate.clear();

  // The overlay owns the viewport while it is up; the document under it stays where it was.
  $effect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  });

  const dialogOpen = () => !!document.querySelector('[role="dialog"][data-state="open"]');

  /** Removes the selection, after asking when the block holds blocks of its own. */
  function requestRemove() {
    const row = focus.currentRow;
    if (!row || focus.locked) return;
    const holdsBlocks = row.children.some((child) => form.blocks.list(child.list).length > 0);
    if (holdsBlocks) confirmRemove = true;
    else focus.removeSelection();
  }

  /** Escape goes back one step: the selection, then one level up. The sheet closes itself. */
  function back() {
    if (!focus.rootSelected) focus.selectRoot();
    else focus.up();
  }

  async function paste() {
    const id = await focus.pasteAfterSelection();
    if (!id) toast.warning(t__('fields.paste_refused'));
  }

  const ADD = t__('fields.add');
  const BLOCK = t__('fields.block');
  const GO_TO = t__('fields.go_to');

  /**
   * What focus mode offers: the types of the list the next insert goes to, what a selected block
   * can do, every row to go to, and the keys that move around. A dialog open keeps the keys.
   */
  useCommands(() => {
    if (!focus.path) return [];
    const types = addable;
    const row = focus.currentRow;
    const editing = !focus.locked;
    const free = () => !dialogOpen();
    return [
      ...(editing
        ? types.map((builder) => ({
            id: `blocks.add.${builder.name}`,
            label: builder.block.label || capitalize(builder.name),
            group: ADD,
            icon: builder.block.icon ?? ToyBrick,
            run: () => focus.insertType(builder.name)
          }))
        : []),
      ...(editing && row && !focus.isNarrowedBlock(row.path)
        ? [
            {
              id: 'blocks.duplicate',
              label: t__('common.duplicate'),
              group: BLOCK,
              keys: 'mod+d',
              when: free,
              run: focus.duplicateSelection
            },
            {
              id: 'blocks.move_up',
              label: t__('fields.move_up'),
              group: BLOCK,
              keys: 'alt+arrowup',
              when: free,
              run: () => focus.moveSelection(-1)
            },
            {
              id: 'blocks.move_down',
              label: t__('fields.move_down'),
              group: BLOCK,
              keys: 'alt+arrowdown',
              when: free,
              run: () => focus.moveSelection(1)
            },
            ...focus.moveTargets().map((target) => ({
              id: `blocks.move_into.${target.list}`,
              label: t__('fields.move_into', target.label),
              group: BLOCK,
              run: () => focus.moveSelectionInto(target.list)
            })),
            {
              id: 'blocks.copy',
              label: t__('fields.copy_block'),
              group: BLOCK,
              keys: 'mod+c',
              when: free,
              run: focus.copySelection
            },
            {
              id: 'blocks.paste',
              label: t__('fields.paste_after'),
              group: BLOCK,
              keys: 'mod+v',
              when: free,
              run: paste
            },
            {
              id: 'blocks.remove',
              label: t__('common.delete'),
              group: BLOCK,
              keys: 'backspace',
              when: free,
              run: requestRemove
            },
            {
              id: 'blocks.remove.delete',
              label: t__('common.delete'),
              keys: 'delete',
              hidden: true,
              when: free,
              run: requestRemove
            }
          ]
        : []),
      {
        id: 'blocks.collapse_all',
        label: t__('fields.collapse_all'),
        group: BLOCK,
        run: focus.collapseAll
      },
      {
        id: 'blocks.expand_all',
        label: t__('fields.expand_all'),
        group: BLOCK,
        run: focus.expandAll
      },
      ...focus.allRows().map((candidate) => ({
        id: `blocks.go_to.${candidate.path}`,
        label: candidate.title,
        group: GO_TO,
        icon: candidate.config?.icon ?? ToyBrick,
        run: () => focus.select(candidate.path)
      })),
      // Keys only
      {
        id: 'blocks.next',
        label: '',
        keys: 'arrowdown',
        hidden: true,
        when: free,
        run: () => focus.selectRelative(1)
      },
      {
        id: 'blocks.next.extend',
        label: '',
        keys: 'shift+arrowdown',
        hidden: true,
        when: free,
        run: () => focus.selectRelative(1, true)
      },
      {
        id: 'blocks.previous',
        label: '',
        keys: 'arrowup',
        hidden: true,
        when: free,
        run: () => focus.selectRelative(-1)
      },
      {
        id: 'blocks.previous.extend',
        label: '',
        keys: 'shift+arrowup',
        hidden: true,
        when: free,
        run: () => focus.selectRelative(-1, true)
      },
      {
        id: 'blocks.expand',
        label: '',
        keys: 'arrowright',
        hidden: true,
        when: () => free() && !!row,
        run: () => focus.setCollapsed(focus.selection[0], false)
      },
      {
        id: 'blocks.collapse',
        label: '',
        keys: 'arrowleft',
        hidden: true,
        when: () => free() && !!row,
        run: () => focus.setCollapsed(focus.selection[0], true)
      },
      {
        id: 'blocks.add_palette',
        label: '',
        keys: '/',
        hidden: true,
        when: () => free() && editing,
        run: focus.pick
      },
      {
        id: 'blocks.back',
        label: '',
        keys: 'escape',
        hidden: true,
        when: free,
        run: back
      }
    ];
  });
</script>

<div
  class="rz-blocks-focus"
  data-focus={focus.path}
  style:left={nav?.width ?? '0'}
  bind:clientWidth={width}
>
  <header class="rz-blocks-focus__header">
    <nav class="rz-blocks-focus__crumbs" aria-label="breadcrumb">
      <button type="button" class="rz-blocks-focus__crumb" onclick={() => focus.close()}>
        {form.title}
      </button>
      {#each crumbs as crumb, index (crumb.list + (crumb.block ?? ''))}
        <span class="rz-blocks-focus__crumb-separator" aria-hidden="true">
          <ChevronRight size={12} />
        </span>
        {#if index === crumbs.length - 1}
          <span class="rz-blocks-focus__crumb rz-blocks-focus__crumb--current">
            {crumb.label}
            {#if builder?.get.localized}
              <sup>{locale.code}</sup>
            {/if}
          </span>
        {:else}
          <button
            type="button"
            class="rz-blocks-focus__crumb"
            onclick={() => focus.open(crumb.list, crumb.block)}
          >
            {crumb.label}
          </button>
        {/if}
      {/each}
      <span class="rz-blocks-focus__count">{countLabel}</span>
    </nav>

    <div class="rz-blocks-focus__header-actions">
      {#if narrow}
        <Button
          class="rz-blocks-focus__panel-toggle"
          variant="ghost"
          size="icon-sm"
          icon={PanelRight}
          aria-label={t__('fields.layers')}
          onclick={() => (panelOpen = true)}
        />
      {/if}
      <CommandButton />
      <ButtonSave {form} size="sm" />
      <Button
        variant="ghost"
        size="icon-sm"
        icon={X}
        title={t__('common.close')}
        aria-label={t__('common.close')}
        onclick={() => focus.close()}
      />
    </div>
  </header>

  <!-- One panel, three tabs: the tree of blocks, the selected block's fields, the types to add. -->
  {#snippet panel()}
    <Tabs.Root
      value={focus.tab}
      onValueChange={(value) => (focus.tab = value as SidebarTab)}
      class="rz-blocks-focus__panel-tabs"
    >
      <Tabs.List class="rz-blocks-focus__panel-list">
        <Tabs.Trigger value="layers" data-label={t__('fields.layers')}>
          {t__('fields.layers')}
        </Tabs.Trigger>
        <Tabs.Trigger value="inspector" data-label={t__('fields.inspector')}>
          {t__('fields.inspector')}
        </Tabs.Trigger>
        {#if !focus.locked}
          <Tabs.Trigger value="add" data-label={t__('fields.blocks')}>
            {t__('fields.blocks')}
          </Tabs.Trigger>
        {/if}
      </Tabs.List>
      <Tabs.Content value="layers" class="rz-blocks-focus__panel-content">
        <div class="rz-blocks-focus__panel-pad rz-blocks-focus__panel-pad--layers">
          <Layers {form} heading={false} />
        </div>
      </Tabs.Content>
      <Tabs.Content value="inspector" class="rz-blocks-focus__panel-content">
        {#if focus.current}
          <Inspector {form} />
        {:else}
          <p class="rz-blocks-focus__panel-hint">{t__('fields.pick_a_block')}</p>
        {/if}
      </Tabs.Content>
      {#if !focus.locked}
        <Tabs.Content value="add" class="rz-blocks-focus__panel-content">
          <div class="rz-blocks-focus__panel-pad"><Palette {form} heading={false} /></div>
        </Tabs.Content>
      {/if}
    </Tabs.Root>
  {/snippet}

  <div class="rz-blocks-focus__body">
    <!--
      The stage: the open list, or the narrowed block alone with what it holds. A click beside the
      blocks selects the root; the blocks and their lists stop their own clicks.
    -->
    <section class="rz-blocks-focus__renders" role="presentation" onclick={focus.selectRoot}>
      {#key focus.path}
        <Renders {form} list={stageList} only={focus.narrowedRow?.index} onRemove={requestRemove} />
      {/key}
    </section>

    {#if narrow}
      <Sheet.Root bind:open={panelOpen}>
        <Sheet.Content
          showCloseButton={false}
          side="right"
          size="sm"
          class="rz-blocks-focus__panel-sheet"
        >
          {@render panel()}
        </Sheet.Content>
      </Sheet.Root>
    {:else}
      <aside class="rz-blocks-focus__panel">{@render panel()}</aside>
    {/if}
  </div>

  <BlockPicker
    bind:open={() => focus.picking, (open) => (focus.picking = open)}
    types={addable}
    onpick={(block) => focus.insertType(block.name)}
  />

  <Dialog.Root bind:open={confirmRemove}>
    <Dialog.Content>
      <Dialog.Header>{t__('fields.remove_with_children_title')}</Dialog.Header>
      <p>{t__('fields.remove_with_children_text')}</p>
      <Dialog.Footer>
        <Button
          onclick={() => {
            confirmRemove = false;
            focus.removeSelection();
          }}
          kbd="enter"
        >
          {t__('common.confirm')}
        </Button>
        <Button onclick={() => (confirmRemove = false)} variant="secondary" kbd="escape">
          {t__('common.cancel')}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
</div>

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  /* The viewport beside the navigation, over the page and its sticky header; each column scrolls
     on its own. */
  .rz-blocks-focus {
    --rz-fields-padding: var(--rz-size-6);
    container: rz-focus / inline-size;
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    background-color: var(--rz-bg-page);
  }

  .rz-blocks-focus__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-4);
    height: var(--rz-size-12);
    padding-inline: var(--rz-size-5) var(--rz-size-2-5);
    border-bottom: 1px solid var(--rz-border);
  }

  .rz-blocks-focus__crumbs {
    display: flex;
    align-items: center;
    gap: var(--rz-size-1-5);
    min-width: 0;
    font-size: var(--rz-text-sm);
  }

  .rz-blocks-focus__crumb {
    white-space: nowrap;
    color: var(--rz-fg-subtle);
    &:is(button):hover {
      color: var(--rz-fg);
    }
    &.rz-blocks-focus__crumb:first-child {
      max-width: 200px;
      @mixin line-clamp 1;
    }
  }

  .rz-blocks-focus__crumb--current {
    @mixin font-medium;
    color: var(--rz-fg);
    sup {
      font-size: var(--rz-text-2xs);
      text-transform: uppercase;
    }
  }

  .rz-blocks-focus__crumb-separator {
    display: flex;
    flex-shrink: 0;
    color: var(--rz-fg-subtle);
  }

  .rz-blocks-focus__count {
    margin-left: var(--rz-size-1);
    font-size: var(--rz-text-xs);
    color: var(--rz-fg-subtle);
    white-space: nowrap;
  }

  /* The ghost icon buttons, the panel's and the close one, are quiet until hovered. */
  .rz-blocks-focus__header-actions {
    --rz-button-ghost-fg: var(--rz-fg-muted);
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    flex-shrink: 0;
    :global(.rz-button--ghost:hover) {
      color: var(--rz-fg);
    }
  }

  /*
   * The stage, a canvas with the blocks centred on it as wide as the document's column at most,
   * and the panel on the right.
   *
   *   --rz-focus-side: the panel, growing with the room, where a block's fields want some
   *   --rz-document-width: the blocks' column, 60rem
   */
  .rz-blocks-focus__body {
    --rz-focus-side: clamp(26rem, 32cqi, 40rem);
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--rz-focus-side);
    min-height: 0;
  }

  .rz-blocks-focus__renders > :global(.rz-renders) {
    max-width: var(--rz-document-width, 60rem);
    margin-inline: auto;
  }

  .rz-blocks-focus__panel,
  .rz-blocks-focus__renders {
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }

  .rz-blocks-focus__panel {
    background-color: var(--rz-bg-page);
    border-left: 1px solid var(--rz-border);
  }

  .rz-blocks-focus__renders {
    background-color: var(--rz-bg-well);
  }

  /*
   * Room around the blocks for the selected one's bar above, and below the last one so it does
   * not sit on the window's edge.
   */
  .rz-blocks-focus__renders {
    padding: var(--rz-size-14) var(--rz-size-8) var(--rz-size-32);
  }

  /* The tabs on the panel's top edge, the content scrolling under them; in a column or a sheet. */
  /* In a column or in a sheet, which sits outside the overlay: the padding its fields read. */
  :global(.rz-blocks-focus__panel-tabs.rz-tabs[data-tabs-root]) {
    /* Room on the left for a rich text's drag handle, which sits outside its field. */
    --rz-fields-padding: var(--rz-size-10);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
    margin: 0;
  }

  /* A track across the panel, its tabs sharing the width. */
  :global(.rz-blocks-focus__panel-list.rz-tabs-list) {
    display: flex;
    width: auto;
    margin: var(--rz-size-2-5) var(--rz-size-3);
  }
  :global(.rz-blocks-focus__panel-list .rz-tabs-trigger) {
    flex: 1;
  }

  /* A hairline between the tabs and what they show. */
  :global(.rz-blocks-focus__panel-content.rz-tabs-content) {
    min-height: 0;
    margin: 0;
    overflow: auto;
    border-top: 1px solid var(--rz-border);
  }

  .rz-blocks-focus__panel-pad {
    padding: var(--rz-size-3);
  }

  .rz-blocks-focus__panel-pad--layers {
    padding: var(--rz-size-1-5);
  }

  .rz-blocks-focus__panel-hint {
    padding: var(--rz-size-8) var(--rz-size-4);
    text-align: center;
    font-size: var(--rz-text-sm);
    color: var(--rz-fg-subtle);
  }

  :global(.rz-blocks-focus__panel-sheet) {
    overflow: hidden;
  }

  /* Narrow: the stage alone, the panel in a sheet from the right, behind the header's button. */
  @container rz-focus (max-width: 52rem) {
    .rz-blocks-focus__body {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
