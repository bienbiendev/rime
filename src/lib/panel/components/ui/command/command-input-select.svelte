<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import { Search } from '@lucide/svelte';

  let {
    ref = $bindable(null),
    class: className,
    value = $bindable(''),
    ...restProps
  }: CommandPrimitive.InputProps = $props();
</script>

<div class="rz-command-input-select {className}" data-command-input-wrapper="">
  <Search class="rz-command-input-select__icon" size={12} />
  <CommandPrimitive.Input
    class="rz-command-input-select__input"
    bind:ref
    {...restProps}
    bind:value
  />
</div>

<style type="postcss">
  .rz-command-input-select {
    display: flex;
    flex: 1;
    align-items: center;
    background-color: transparent;

    & :global(.rz-command-input-select__icon) {
      margin-right: var(--rz-size-2);
      flex-shrink: 0;
      opacity: 0.5;
    }

    & :global(.rz-command-input-select__input) {
      display: flex;
      height: var(--rz-size-5);
      width: 100%;
      background-color: transparent;
      font-size: var(--rz-text-sm);
      outline: none;
    }

    & :global(.rz-command-input-select__input::placeholder) {
      @mixin color color-fg, 0.4;
    }

    & :global(.rz-command-input-select__input:disabled) {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }
</style>
