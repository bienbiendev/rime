<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import * as Command from '$lib/panel/components/ui/command/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { capitalize } from '$lib/util/string.js';
  import { Command as Cmd, Delete, MoveDown, MoveUp, Option, ToyBrick } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { getBlocksFocusContext } from './focus.svelte.js';

  type Props = { form: DocumentFormContext; open: boolean; onRemove: () => void };
  let { form, open = $bindable(false), onRemove }: Props = $props();

  const focus = getBlocksFocusContext()!;
  const list = $derived(focus.current?.list ?? focus.path ?? '');
  const types = $derived(list ? (form.blocks.builder(list)?.get.blocks ?? []) : []);
  const row = $derived(focus.currentRow);
  const targets = $derived(open && row ? focus.moveTargets() : []);

  function run(action: () => unknown) {
    open = false;
    action();
  }

  async function paste() {
    const id = await focus.pasteAfterSelection();
    if (!id) toast.warning(t__('fields.paste_refused'));
  }
</script>

<!-- One flat list: a prefix says what kind of thing each line is. -->
<Command.Dialog bind:open>
  <Command.Input placeholder={t__('common.search')} />
  <Command.List class="rz-blocks-command__list">
    <Command.Empty>{t__('fields.no_block')}</Command.Empty>

    {#if !focus.locked}
      {#each types as blockBuilder (blockBuilder.name)}
        {@const block = blockBuilder.block}
        {@const Icon = block.icon ?? ToyBrick}
        <Command.Item
          class="rz-blocks-command__item"
          value="add {block.name} {block.label ?? ''}"
          onSelect={() => run(() => focus.insertType(block.name))}
        >
          <span class="rz-blocks-command__prefix">{t__('fields.add')}</span>
          <span class="rz-blocks-command__icon"><Icon size={13} /></span>
          <span class="rz-blocks-command__label">{block.label || capitalize(block.name)}</span>
        </Command.Item>
      {/each}

      {#if row}
        <Command.Item
          class="rz-blocks-command__item"
          value="block duplicate"
          onSelect={() => run(focus.duplicateSelection)}
        >
          <span class="rz-blocks-command__prefix">{t__('fields.block')}</span>
          <span class="rz-blocks-command__label">{t__('common.duplicate')}</span>
          <kbd><Cmd size="10" />D</kbd>
        </Command.Item>
        <Command.Item
          class="rz-blocks-command__item"
          value="block move up"
          onSelect={() => run(() => focus.moveSelection(-1))}
        >
          <span class="rz-blocks-command__prefix">{t__('fields.block')}</span>
          <span class="rz-blocks-command__label">{t__('fields.move_up')}</span>
          <kbd><Option size="10" /><MoveUp size="10" /></kbd>
        </Command.Item>
        <Command.Item
          class="rz-blocks-command__item"
          value="block move down"
          onSelect={() => run(() => focus.moveSelection(1))}
        >
          <span class="rz-blocks-command__prefix">{t__('fields.block')}</span>
          <span class="rz-blocks-command__label">{t__('fields.move_down')}</span>
          <kbd><Option size="10" /><MoveDown size="10" /></kbd>
        </Command.Item>
        {#each targets as target (target.list)}
          <Command.Item
            class="rz-blocks-command__item"
            value="block move into {target.label} {target.list}"
            onSelect={() => run(() => focus.moveSelectionInto(target.list))}
          >
            <span class="rz-blocks-command__prefix">{t__('fields.block')}</span>
            <span class="rz-blocks-command__label">{t__('fields.move_into', target.label)}</span>
          </Command.Item>
        {/each}
        <Command.Item
          class="rz-blocks-command__item"
          value="block copy"
          onSelect={() => run(focus.copySelection)}
        >
          <span class="rz-blocks-command__prefix">{t__('fields.block')}</span>
          <span class="rz-blocks-command__label">{t__('fields.copy_block')}</span>
          <kbd><Cmd size="10" />C</kbd>
        </Command.Item>
        <Command.Item
          class="rz-blocks-command__item"
          value="block paste after"
          onSelect={() => run(paste)}
        >
          <span class="rz-blocks-command__prefix">{t__('fields.block')}</span>
          <span class="rz-blocks-command__label">{t__('fields.paste_after')}</span>
          <kbd><Cmd size="10" />V</kbd>
        </Command.Item>
        <Command.Item
          class="rz-blocks-command__item"
          value="block delete remove"
          onSelect={() => run(onRemove)}
        >
          <span class="rz-blocks-command__prefix">{t__('fields.block')}</span>
          <span class="rz-blocks-command__label">{t__('common.delete')}</span>
          <kbd><Delete size="12" /></kbd>
        </Command.Item>
      {/if}
    {/if}
  </Command.List>
</Command.Dialog>

<style lang="postcss">
  :global(.rz-blocks-command__list) {
    max-height: 60vh;
    padding: var(--rz-size-2);
  }

  :global(.rz-blocks-command__item) {
    display: flex;
    min-height: var(--rz-size-9);
    align-items: center;
    gap: var(--rz-size-2);
  }

  .rz-blocks-command__prefix {
    font-size: var(--rz-text-2xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: hsl(var(--rz-color-fg) / 0.45);
    min-width: var(--rz-size-12);
  }

  .rz-blocks-command__icon {
    display: flex;
    opacity: 0.7;
  }

  .rz-blocks-command__label {
    flex: 1;
  }

  kbd {
    font-size: var(--rz-text-xs);
    display: flex;
    text-align: center;
    gap: var(--rz-size-1);
    color: hsl(var(--rz-color-fg) / 0.5);
  }
</style>
