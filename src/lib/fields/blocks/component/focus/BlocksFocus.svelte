<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import ButtonSave from '$lib/panel/components/sections/document/ButtonSave.svelte';
  import { Button } from '$lib/panel/components/ui/button/index.js';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { getNavContext } from '$lib/panel/context/nav.svelte.js';
  import { populate } from '$lib/panel/util/populate.js';
  import { Command, X } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import CommandPalette from './CommandPalette.svelte';
  import { getBlocksFocusContext } from './focus.svelte.js';
  import Layers from './Layers.svelte';
  import Palette from './Palette.svelte';
  import Renders from './Renders.svelte';
  import Stage from './Stage.svelte';

  const { form }: { form: DocumentFormContext } = $props();

  const focus = getBlocksFocusContext()!;
  const locale = getLocaleContext();
  /** The overlay starts where the navigation ends, folded or not. */
  const nav = getNavContext();

  const builder = $derived(focus.path ? form.blocks.builder(focus.path) : undefined);
  const crumbs = $derived(focus.breadcrumb());
  const count = $derived(focus.path ? form.blocks.list(focus.path).length : 0);
  const countLabel = $derived(
    count === 1 ? t__('fields.blocks_count', '1') : t__('fields.blocks_count|m|p', String(count))
  );

  let commandOpen = $state(false);
  let confirmRemove = $state(false);

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

  /** A field has the keyboard: single keys are its, ⌘ combinations are still the focus mode's. */
  function isTyping(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
    if (target instanceof HTMLSelectElement || target.isContentEditable) return true;
    return !!target.closest('.ProseMirror');
  }

  const dialogOpen = () => !!document.querySelector('[role="dialog"][data-state="open"]');

  /** Removes the selection, after asking when the block holds blocks of its own. */
  function requestRemove() {
    const row = focus.currentRow;
    if (!row || focus.locked) return;
    const holdsBlocks = row.children.some((child) => form.blocks.list(child.list).length > 0);
    if (holdsBlocks) confirmRemove = true;
    else focus.removeSelection();
  }

  async function paste() {
    const id = await focus.pasteAfterSelection();
    if (!id) toast.warning(t__('fields.paste_refused'));
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!focus.path) return;
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (meta && key === 'k') {
      event.preventDefault();
      commandOpen = true;
      return;
    }
    if (event.key === 'Escape') {
      if (dialogOpen() || isTyping(event.target)) return;
      event.preventDefault();
      return focus.close();
    }
    if (isTyping(event.target) || dialogOpen()) return;

    if (meta && key === 'd') {
      event.preventDefault();
      return focus.duplicateSelection();
    }
    if (meta && key === 'c') return focus.copySelection();
    if (meta && key === 'v') return paste();
    if (meta) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        return event.altKey ? focus.moveSelection(1) : focus.selectRelative(1, event.shiftKey);
      case 'ArrowUp':
        event.preventDefault();
        return event.altKey ? focus.moveSelection(-1) : focus.selectRelative(-1, event.shiftKey);
      case 'ArrowRight':
        if (focus.current) focus.setCollapsed(focus.selection[0], false);
        return;
      case 'ArrowLeft':
        if (focus.current) focus.setCollapsed(focus.selection[0], true);
        return;
      case 'Backspace':
      case 'Delete':
        event.preventDefault();
        return requestRemove();
    }
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<div
  class="rz-blocks-focus"
  data-focus={focus.path}
  data-layout={focus.hasRenders ? 'renders' : 'fields'}
  style:left={nav?.width ?? '0'}
>
  <header class="rz-blocks-focus__header">
    <nav class="rz-blocks-focus__crumbs" aria-label="breadcrumb">
      <button type="button" class="rz-blocks-focus__crumb" onclick={() => focus.close()}>
        {form.title}
      </button>
      {#each crumbs as crumb, index (crumb.list + (crumb.block ?? ''))}
        <span class="rz-blocks-focus__crumb-separator">›</span>
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
      <button type="button" class="rz-blocks-focus__kbd" onclick={() => (commandOpen = true)}>
        <kbd><Command size="10" /> K</kbd>
      </button>
      <ButtonSave {form} size="sm" />
      <Button variant="ghost" size="icon" icon={X} onclick={() => focus.close()} />
    </div>
  </header>

  <div class="rz-blocks-focus__body">
    <aside class="rz-blocks-focus__layers">
      <Layers {form} />
    </aside>
    {#if focus.hasRenders}
      <!-- A click beside the blocks selects the root; the blocks stop their own clicks. -->
      <section class="rz-blocks-focus__renders" role="presentation" onclick={focus.selectRoot}>
        <Renders {form} list={focus.path ?? ''} />
      </section>
      <aside class="rz-blocks-focus__inspector">
        {#if focus.current}
          <Stage {form} onRemove={requestRemove} />
        {:else if !focus.locked}
          <div class="rz-blocks-focus__inspector-palette"><Palette {form} /></div>
        {/if}
      </aside>
    {:else}
      <section class="rz-blocks-focus__stage">
        <Stage {form} onRemove={requestRemove} />
      </section>
      {#if !focus.locked}
        <aside class="rz-blocks-focus__palette">
          <Palette {form} />
        </aside>
      {/if}
    {/if}
  </div>

  <CommandPalette {form} bind:open={commandOpen} onRemove={requestRemove} />

  <Dialog.Root bind:open={confirmRemove}>
    <Dialog.Content>
      <Dialog.Header>{t__('fields.remove_with_children_title')}</Dialog.Header>
      <p>{t__('fields.remove_with_children_text')}</p>
      <Dialog.Footer --rz-justify-content="space-between">
        <Button
          onclick={() => {
            confirmRemove = false;
            focus.removeSelection();
          }}
        >
          {t__('common.confirm')}
        </Button>
        <Button onclick={() => (confirmRemove = false)} variant="secondary">
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
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    background-color: hsl(var(--rz-color-bg));
  }

  .rz-blocks-focus__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-4);
    height: var(--rz-size-12);
    padding-inline: var(--rz-size-4);
    border-bottom: var(--rz-border);
  }

  .rz-blocks-focus__crumbs {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    min-width: 0;
    font-size: var(--rz-text-sm);
  }

  .rz-blocks-focus__crumb {
    white-space: nowrap;
    color: hsl(var(--rz-color-fg) / 0.6);
    &:is(button):hover {
      color: hsl(var(--rz-color-fg));
    }
    &.rz-blocks-focus__crumb:first-child {
      max-width: 200px;
      @mixin line-clamp 1;
    }
  }

  .rz-blocks-focus__crumb--current {
    @mixin font-medium;
    color: hsl(var(--rz-color-fg));
    sup {
      font-size: var(--rz-text-2xs);
      text-transform: uppercase;
    }
  }

  .rz-blocks-focus__crumb-separator {
    color: hsl(var(--rz-color-fg) / 0.3);
  }

  .rz-blocks-focus__count {
    margin-left: var(--rz-size-2);
    font-size: var(--rz-text-xs);
    color: hsl(var(--rz-color-fg) / 0.5);
    white-space: nowrap;
  }

  .rz-blocks-focus__header-actions {
    display: flex;
    align-items: center;
    gap: var(--rz-size-3);
    flex-shrink: 0;
  }

  .rz-blocks-focus__kbd {
    display: flex;
    gap: var(--rz-size-1);
    kbd {
      display: flex;
      gap: var(--rz-size-1);
      align-items: center;
      border: var(--rz-border);
      border-radius: var(--rz-radius-sm);
      padding: 0 var(--rz-size-2);
      font-size: var(--rz-text-xs);
      line-height: var(--rz-size-5);
      min-width: var(--rz-size-5);
      text-align: center;
    }
  }

  .rz-blocks-focus__body {
    display: grid;
    grid-template-columns: minmax(14rem, 1fr) minmax(0, 3fr) minmax(12rem, 1fr);
    min-height: 0;
  }

  /* With renders: layers, the stack of renders, the inspector. */
  .rz-blocks-focus[data-layout='renders'] .rz-blocks-focus__body {
    grid-template-columns: minmax(14rem, 1fr) minmax(0, 3fr) minmax(22rem, 1.5fr);
  }

  .rz-blocks-focus__layers,
  .rz-blocks-focus__palette,
  .rz-blocks-focus__stage,
  .rz-blocks-focus__renders,
  .rz-blocks-focus__inspector {
    min-height: 0;
    overflow: auto;
  }

  .rz-blocks-focus__layers,
  .rz-blocks-focus__palette {
    padding: var(--rz-size-4);
  }

  .rz-blocks-focus__layers {
    border-right: var(--rz-border);
  }

  .rz-blocks-focus__palette {
    border-left: var(--rz-border);
  }

  .rz-blocks-focus__stage,
  .rz-blocks-focus__renders,
  .rz-blocks-focus__inspector {
    min-width: 0;
  }

  .rz-blocks-focus__renders {
    padding: var(--rz-size-6);
  }

  .rz-blocks-focus__inspector {
    border-left: var(--rz-border);
  }

  .rz-blocks-focus__inspector-palette {
    padding: var(--rz-size-4);
  }

  @media (max-width: 60rem) {
    .rz-blocks-focus__body,
    .rz-blocks-focus[data-layout='renders'] .rz-blocks-focus__body {
      grid-template-columns: minmax(12rem, 1fr) minmax(0, 2fr);
    }
    .rz-blocks-focus__palette,
    .rz-blocks-focus__renders {
      display: none;
    }
  }
</style>
