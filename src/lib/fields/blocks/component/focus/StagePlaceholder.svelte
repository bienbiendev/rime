<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import Kbd from '$lib/panel/components/ui/kbd/Kbd.svelte';
  import { getBlocksFocusContext } from './focus.svelte.js';

  const focus = getBlocksFocusContext()!;

  /** "Type $1 to add a block", cut around the key. */
  const KEY = '\u0000';
  const [before, after] = $derived(t__('fields.type_to_add_block', KEY).split(KEY));

  /** Adds at the end of the open list: the root selected, then the picker, as `/` opens. */
  function add(event: MouseEvent) {
    event.stopPropagation();
    focus.selectRoot();
    focus.pick();
  }
</script>

<!-- Under the blocks: the key that adds one, and a click that does the same. -->
<button type="button" class="rz-stage-placeholder" onclick={add}>
  {before}<Kbd keys="/" />{after}
</button>

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  .rz-stage-placeholder {
    display: block;
    width: 100%;
    padding: var(--rz-size-1) var(--rz-size-1-5);
    border-radius: var(--rz-radius-lg);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-xl);
    text-align: left;
    cursor: text;
    transition: color 0.15s;

    &:hover {
      color: var(--rz-fg-muted);
    }
    &:focus-visible {
      @mixin focus-ring;
    }

    :global(.rz-kbd) {
      margin-inline: var(--rz-size-0-5);
      color: var(--rz-fg-muted);
      font-size: var(--rz-text-sm);
      vertical-align: text-bottom;
    }
  }
</style>
