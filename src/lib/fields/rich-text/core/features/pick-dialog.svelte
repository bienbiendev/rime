<script lang="ts" generics="T">
  import { t__ } from '#lib/core/i18n/index.js';
  import * as Command from '#lib/panel/components/ui/command/index.js';
  import type { Snippet } from 'svelte';

  type Props = {
    open: boolean;
    items: T[];
    /** The text the search matches, and the row's content when no `row` snippet is given. */
    label: (item: T) => string;
    onPick: (item: T) => void;
    placeholder?: string;
    row?: Snippet<[T]>;
  };

  let {
    open = $bindable(false),
    items,
    label,
    onPick,
    placeholder = t__('common.search'),
    row
  }: Props = $props();
</script>

<!-- A searchable list of fetched documents; picking one calls `onPick`. -->
<Command.Dialog bind:open preventScroll={false}>
  <Command.Input {placeholder} />
  <Command.List>
    <Command.Empty>{t__('common.nothing_found')}</Command.Empty>
    {#each items as item, index (index)}
      <Command.Item value={label(item)} onSelect={() => onPick(item)}>
        {#if row}
          {@render row(item)}
        {:else}
          {label(item)}
        {/if}
      </Command.Item>
    {/each}
  </Command.List>
</Command.Dialog>
