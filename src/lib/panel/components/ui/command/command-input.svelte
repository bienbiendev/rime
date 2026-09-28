<script lang="ts">
  import { Search } from '@lucide/svelte';
  import { Command as CommandPrimitive } from 'bits-ui';
  import type { Snippet } from 'svelte';

  let {
    ref = $bindable(null),
    class: className,
    value = $bindable(''),
    end,
    ...restProps
  }: CommandPrimitive.InputProps & {
    /** Drawn after the input, on its right: a key hint. */
    end?: Snippet;
  } = $props();
</script>

<div class="rz-command-input" data-command-input-wrapper="">
  <Search class="rz-command-input__icon" size={14} />
  <CommandPrimitive.Input
    class="rz-command-input__input {className}"
    bind:ref
    {...restProps}
    bind:value
  />
  {@render end?.()}
</div>

<style type="postcss">
  @import '../../../style/mixins/index.css';

  .rz-command-input {
    @mixin well;
    display: flex;
    align-items: center;
    border-top-left-radius: var(--rz-radius-md);
    border-top-right-radius: var(--rz-radius-md);
    padding-inline: var(--rz-size-3);
    padding-block: var(--rz-size-1);

    &:global([data-focused]) {
      @mixin focus-field;
    }

    &:global([data-error]) {
      @mixin invalid-field;
    }

    & :global(.rz-command-input__icon) {
      margin-right: var(--rz-size-2);
      flex-shrink: 0;
      color: var(--rz-fg-subtle);
    }

    & :global(.rz-command-input__input) {
      display: flex;
      height: var(--rz-input-height);
      width: 100%;
      background-color: transparent;
      font-size: var(--rz-text-sm);
      outline: none;
    }

    & :global(.rz-command-input__input::placeholder) {
      color: var(--rz-fg-subtle);
    }

    & :global(.rz-command-input__input:disabled) {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }
</style>
