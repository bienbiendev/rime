<script lang="ts">
  import { formatKeys, isMac, parseKeys } from '$lib/panel/util/keys.js';
  import {
    ArrowBigUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Command,
    CornerDownLeft,
    Delete,
    Option
  } from '@lucide/svelte';

  /**
   * A key chord drawn key by key: `mod+k` -> [⌘] [K] on a Mac, [Ctrl] [K] elsewhere.
   * `plain` drops the key caps, for a chord inside a button.
   */
  type Props = { keys: string; plain?: boolean };
  const { keys, plain = false }: Props = $props();

  // The server cannot tell the platform: the chord starts as elsewhere and turns Mac once mounted.
  let mac = $state(false);
  $effect(() => {
    mac = isMac();
  });

  const chord = $derived(parseKeys(keys));

  const ICONS: Record<string, typeof Command> = {
    arrowup: ArrowUp,
    arrowdown: ArrowDown,
    arrowleft: ArrowLeft,
    arrowright: ArrowRight,
    enter: CornerDownLeft,
    backspace: Delete
  };
  const LABELS: Record<string, string> = { escape: 'esc', delete: 'del', ' ': 'space' };
</script>

{#snippet cap(label: string, Icon?: typeof Command)}
  <span class="rz-kbd__key">
    {#if Icon}<Icon size="1em" strokeWidth={2} />{:else}{label}{/if}
  </span>
{/snippet}

<kbd class="rz-kbd" class:rz-kbd--plain={plain} aria-label={formatKeys(keys, mac)}>
  {#if chord.mod}{@render cap('Ctrl', mac ? Command : undefined)}{/if}
  {#if chord.alt}{@render cap('Alt', mac ? Option : undefined)}{/if}
  {#if chord.shift}{@render cap('Shift', mac ? ArrowBigUp : undefined)}{/if}
  {@render cap(LABELS[chord.key] ?? chord.key.toUpperCase(), ICONS[chord.key])}
</kbd>

<style type="postcss">
  .rz-kbd {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 2px;
    color: var(--rz-fg-subtle);
    font-family: var(--rz-font-sans);
    font-size: var(--rz-text-xs);
    line-height: 1;
  }

  .rz-kbd__key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.6em;
    height: 1.6em;
    padding: 0 0.35em;
    border-radius: var(--rz-radius-sm);
    background-color: var(--rz-bg-well);
    box-shadow: inset 0 0 0 1px var(--rz-border);
  }

  .rz-kbd--plain {
    gap: 0.15em;
    color: inherit;

    .rz-kbd__key {
      min-width: 0;
      height: auto;
      padding: 0;
      background: none;
      box-shadow: none;
    }
  }
</style>
