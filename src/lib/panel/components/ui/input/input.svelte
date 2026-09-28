<script lang="ts">
  import type { IconProps } from '@lucide/svelte';
  import type { WithElementRef, WithoutChildren } from 'bits-ui';
  import type { Component } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type PrimitiveInputAttributes = WithElementRef<HTMLInputAttributes>;

  let {
    ref = $bindable(null),
    value = $bindable(),
    class: className,
    icon,
    ...restProps
  }: WithoutChildren<PrimitiveInputAttributes> & { icon?: Component<IconProps> } = $props();
</script>

<div class="rz-input-wrapper {className}">
  {#if icon}
    {@const Icon = icon}
    <div class="rz-input__icon">
      <Icon size={14} strokeWidth="2px" />
    </div>
  {/if}
  <input bind:this={ref} class="rz-input" bind:value {...restProps} />
</div>

<style type="postcss">
  @import '../../../style/mixins/index.css';

  :root {
    --rz-input-border-color: var(--rz-border);
    --rz-input-padding-x: var(--rz-size-3);
    --rz-input-padding-y: var(--rz-size-1);
  }

  .rz-input {
    @mixin well;
    display: flex;
    height: var(--rz-input-height);
    width: 100%;
    border-radius: var(--rz-radius-lg);
    transition: all 0.1s ease-in-out;
    padding: var(--rz-input-padding-y) var(--rz-input-padding-x);
  }

  .rz-input__icon + .rz-input {
    padding-left: calc(var(--rz-input-padding-x) + var(--rz-size-6));
  }

  /* Inset shadows cover the browser's autofill fill: the page, then the well tinted with the accent. */
  input.rz-input:is(:-webkit-autofill, :autofill) {
    --color: color-mix(in oklab, var(--rz-bg-well), var(--rz-accent) 12%);
    background-color: var(--color) !important;
    box-shadow:
      0 0 0 1000px var(--color) inset,
      0 0 0 1000px var(--rz-bg-page) inset !important;
    color: var(--rz-fg) !important;
    -webkit-text-fill-color: var(--rz-fg) !important;
  }
  input.rz-input:is(:-webkit-autofill, :autofill):focus {
    --color: color-mix(in oklab, var(--rz-bg-well), var(--rz-accent) 24%);
    background-color: var(--color) !important;
    box-shadow:
      0 0 0 1000px var(--color) inset,
      0 0 0 1000px var(--rz-bg-page) inset,
      0 0 0 3px var(--rz-ring) !important;
    color: var(--rz-fg) !important;
    -webkit-text-fill-color: var(--rz-fg) !important;
  }

  .rz-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .rz-input::placeholder {
    color: var(--rz-fg-subtle);
  }

  .rz-input:focus-visible {
    @mixin focus-field;
  }

  .rz-input[data-error] {
    @mixin invalid-field;
  }

  .rz-input-wrapper {
    position: relative;
    width: 100%;

    .rz-input__icon {
      position: absolute;
      left: var(--rz-size-3);
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--rz-fg-subtle);
    }

    .rz-input__icon:has(+ .rz-input:focus-visible) {
      color: var(--rz-fg);
    }
  }
</style>
