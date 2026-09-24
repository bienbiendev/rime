<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import CommandButton from '$lib/panel/components/sections/commands/CommandButton.svelte';
  import ButtonSave from '$lib/panel/components/sections/document/ButtonSave.svelte';
  import { Button } from '$lib/panel/components/ui/button/index.js';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import { getCommandsContext, useCommands } from '$lib/panel/context/commands.svelte.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { getNavContext } from '$lib/panel/context/nav.svelte.js';
  import { populate } from '$lib/panel/util/populate.js';
  import { capitalize } from '$lib/util/string.js';
  import { ToyBrick, X } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { getBlocksFocusContext } from './focus.svelte.js';
  import Layers from './Layers.svelte';
  import Palette from './Palette.svelte';
  import Renders from './Renders.svelte';
  import Stage from './Stage.svelte';

  const { form }: { form: DocumentFormContext } = $props();

  const focus = getBlocksFocusContext()!;
  const locale = getLocaleContext();
  const commands = getCommandsContext();
  /** The overlay starts where the navigation ends, folded or not. */
  const nav = getNavContext();

  const builder = $derived(focus.path ? form.blocks.builder(focus.path) : undefined);
  const crumbs = $derived(focus.breadcrumb());
  const count = $derived(focus.path ? form.blocks.list(focus.path).length : 0);
  const countLabel = $derived(
    count === 1 ? t__('fields.blocks_count', '1') : t__('fields.blocks_count|m|p', String(count))
  );

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

  const ADD = t__('fields.add');
  const BLOCK = t__('fields.block');
  const GO_TO = t__('fields.go_to');

  /**
   * What focus mode offers: the types of the list the next insert goes to, what a selected block
   * can do, every row to go to, and the keys that move around. A dialog open keeps the keys.
   */
  useCommands(() => {
    if (!focus.path) return [];
    const list = focus.current?.list ?? focus.path;
    const types = form.blocks.builder(list)?.get.blocks ?? [];
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
      ...(editing && row
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
        run: () => commands?.palette.show({ group: ADD })
      },
      {
        id: 'blocks.close',
        label: '',
        keys: 'escape',
        hidden: true,
        when: free,
        run: () => focus.close()
      }
    ];
  });
</script>

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
      <CommandButton />
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

  .rz-blocks-focus__stage,
  .rz-blocks-focus__renders {
    background-color: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-1)));
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
