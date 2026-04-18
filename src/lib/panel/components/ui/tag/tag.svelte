<script lang="ts">
  import { X } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  type Props = { readOnly: boolean; children: Snippet; onRemove: () => void };
  const { readOnly, children, onRemove }: Props = $props();
</script>

<div class="rz-tag" class:rz-tag--readonly={readOnly}>
  <span>
    {@render children?.()}
  </span>
  <button
    class="rz-tag__button"
    class:rz-tag__button--readonly={readOnly}
    type="button"
    onclick={onRemove}
  >
    <X size={13} />
  </button>
</div>

<style type="postcss" global>
  :root {
    --tag-color-bg: hsl(var(--rz-gray-0));
    --tag-color-fg: hsl(var(--rz-gray-13));
  }

  .rz-tag {
    background-color: var(--tag-color-bg);
    color: var(--tag-color-fg);
    border-radius: var(--rz-radius-sm);
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    font-size: var(--rz-text-sm);
    padding: 0.2rem var(--rz-size-2);
  }

  .rz-tag--readonly {
    opacity: 0.3;
    cursor: no-drop;
  }

  .rz-tag__button {
    border-radius: var(--rz-radius-sm);
    cursor: pointer;
  }

  .rz-tag__button:focus-visible {
    outline: none;
    background-color: hsl(var(--rz-color-ring));
  }

  .rz-tag__button--readonly {
    cursor: no-drop;
  }
</style>
