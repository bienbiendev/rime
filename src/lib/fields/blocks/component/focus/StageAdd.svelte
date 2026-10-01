<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { Button } from '$lib/panel/components/ui/button/index.js';
  import Kbd from '$lib/panel/components/ui/kbd/Kbd.svelte';
  import { Plus } from '@lucide/svelte';
  import { getBlocksFocusContext } from './focus.svelte.js';

  type Props = { list: string };
  const { list }: Props = $props();

  const focus = getBlocksFocusContext()!;

  /** "Add a block or type $1", cut around the key. */
  const KEY = '\u0000';
  const [before, after] = $derived(t__('fields.add_block_or_type', KEY).split(KEY));

  /** Adds at the end of the list, as its `+` does. */
  function add(event: MouseEvent) {
    event.stopPropagation();
    focus.pick(list);
  }
</script>

<!-- Under the blocks: a button that adds one, and the key that does too. -->
<div class="rz-stage-add">
  <Button variant="ghost" icon={Plus} onclick={add}>
    {before}<Kbd keys="/" />{after}
  </Button>
</div>

<style lang="postcss">
  /* Quiet until hovered. */
  .rz-stage-add {
    --rz-button-ghost-fg: var(--rz-fg-subtle);
    :global(.rz-button--ghost:hover) {
      color: var(--rz-fg);
    }
    :global(.rz-kbd) {
      margin-inline: var(--rz-size-0-5);
    }
  }
</style>
