<script lang="ts">
  import Kbd from '../kbd/Kbd.svelte';
  import type { Props } from './index.js';

  let {
    class: className,
    variant = 'default',
    size = 'default',
    ref = $bindable(null),
    href = undefined,
    type = 'button',
    icon,
    kbd,
    children,
    ...restProps
  }: Props = $props();
</script>

{#snippet kbdProp()}
  {#if kbd}
    <span class="rz-button__kbd"><Kbd keys={kbd} plain /></span>
  {/if}
{/snippet}

{#snippet iconProp()}
  {#if icon}
    {@const IconProp = icon}
    {#if variant === 'text'}
      <div class="rz-button--text__icon">
        <IconProp size="15" strokeWidth="2px" />
      </div>
    {:else}
      <div class="rz-button__icon">
        <IconProp size={size === 'xs' ? 10 : 14} strokeWidth="2px" />
      </div>
    {/if}
  {/if}
{/snippet}

{#if href}
  <a
    bind:this={ref}
    {href}
    class="rz-button rz-button--size-{size} rz-button--{variant} {className}"
    {...restProps}
  >
    {@render iconProp()}
    {@render children?.()}
  </a>
{:else}
  <button
    bind:this={ref}
    class="rz-button rz-button--size-{size} rz-button--{variant} {className}"
    {type}
    data-kbd={kbd}
    {...restProps}
  >
    {@render iconProp()}
    {@render children?.()}
    {@render kbdProp()}
  </button>
{/if}

<style type="postcss">
  @import '../../../style/mixins/index.css';

  :root {
    --rz-button-tl-radius: var(--rz-radius-lg);
    --rz-button-tr-radius: var(--rz-radius-lg);
    --rz-button-br-radius: var(--rz-radius-lg);
    --rz-button-bl-radius: var(--rz-radius-lg);

    /* Success variant */
    --rz-button-success-bg: var(--rz-accent);
    --rz-button-success-fg: var(--rz-accent-fg);

    /* Outline variant */
    --rz-button-outline-bg: transparent;
    --rz-button-outline-fg: var(--rz-fg);
    --rz-button-outline-border: var(--rz-border-strong);
    --rz-button-outline-bg-hover: var(--rz-bg-hover);
    /* border-width */
    --rz-button-outline-border-left-width: 1px;
    --rz-button-outline-border-top-width: 1px;
    --rz-button-outline-border-right-width: 1px;
    --rz-button-outline-border-bottom-width: 1px;

    /* Ghost variant */
    --rz-button-ghost-bg: transparent;
    --rz-button-ghost-bg-hover: var(--rz-bg-hover);
    --rz-button-ghost-fg: var(--rz-fg);

    /* Secondary variant */
    --rz-button-secondary-bg: var(--rz-bg-raised);
    --rz-button-secondary-fg: var(--rz-fg);

    /* Link variant */
    --rz-button-link-bg: transparent;
    --rz-button-link-bg-hover: transparent;
    --rz-button-link-fg: var(--rz-fg);

    /* Text variant */
    --rz-button-text-bg: transparent;
    --rz-button-text-fg: var(--rz-fg-muted);
    --rz-button-text-fg-hover: var(--rz-fg);
    --rz-button-text-fg-disabled: var(--rz-fg-subtle);
  }

  .rz-button {
    flex-shrink: var(--rz-flex-shrink, unset);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--rz-button-tl-radius) var(--rz-button-tr-radius) var(--rz-button-br-radius)
      var(--rz-button-bl-radius);
    white-space: nowrap;
    @mixin font-medium;
    transition-property:
      box-shadow, color, background-color, border-color, text-decoration-color, fill, stroke,
      filter;
    transition-duration: 0.25s;
    gap: var(--rz-size-2);
    fill: currentColor;
  }

  .rz-button:focus-visible {
    @mixin focus-ring;
  }

  .rz-button:disabled,
  .rz-button[disabled='true'] {
    opacity: 0.5;
    cursor: no-drop !important;
  }

  /**************************************/
  /* Sizes */
  /**************************************/

  .rz-button--size-default {
    font-size: var(--rz-text-md);
    height: var(--rz-size-9);
    padding: var(--rz-size-2) var(--rz-size-4);
  }

  .rz-button--size-xs {
    height: var(--rz-size-6);
    padding: var(--rz-size-1) var(--rz-size-2);
    font-size: var(--rz-text-2xs);
    border-radius: var(--rz-radius-lg);
  }

  .rz-button--size-sm {
    font-size: var(--rz-text-md);
    height: var(--rz-size-8);
    padding: var(--rz-size-2) var(--rz-size-3);
    border-radius: var(--rz-radius-lg);
  }

  .rz-button--size-lg {
    font-size: var(--rz-text-md);
    height: var(--rz-size-12);
    padding: var(--rz-size-2) var(--rz-size-8);
    border-radius: var(--rz-radius-lg);
  }

  .rz-button--size-xl {
    height: var(--rz-size-14);
    font-size: var(--rz-text-md);
    padding: var(--rz-size-2) var(--rz-size-8);
    border-radius: var(--rz-radius-lg);
  }

  .rz-button--size-icon {
    border-radius: var(--rz-radius-lg);
    height: var(--rz-size-9);
    width: var(--rz-size-9);
    padding: var(--rz-size-1);
  }

  .rz-button--size-icon-sm {
    height: var(--rz-size-8);
    width: var(--rz-size-8);
  }

  /**************************************/
  /* Variants */
  /**************************************/

  /** Default */
  .rz-button--default {
    @mixin primary;
    &:hover:not(:disabled) {
      filter: brightness(1.12);
    }
  }

  /** Success */
  .rz-button--success {
    background-color: var(--rz-button-success-bg);
    color: var(--rz-button-success-fg);
    &:hover:not(:disabled) {
      filter: brightness(1.12);
    }
  }

  /** Outline */
  .rz-button--outline {
    border-style: solid;
    border-color: var(--rz-button-outline-border);

    border-left-width: var(--rz-button-outline-border-left-width);
    border-top-width: var(--rz-button-outline-border-top-width);
    border-right-width: var(--rz-button-outline-border-right-width);
    border-bottom-width: var(--rz-button-outline-border-bottom-width);

    background-color: var(--rz-button-outline-bg);
    color: var(--rz-button-outline-fg);

    &:hover:not(:disabled) {
      background-color: var(--rz-button-outline-bg-hover);
    }
  }

  /** Ghost */
  .rz-button--ghost {
    background-color: var(--rz-button-ghost-bg);
    color: var(--rz-button-ghost-fg);

    &:hover:not(:disabled),
    &:active:not(:disabled),
    &[aria-expanded='true'],
    &[data-state='open'] {
      background-color: var(--rz-button-ghost-bg-hover);
    }
  }

  /** Secondary */
  .rz-button--secondary {
    @mixin surface raised;
    background-color: var(--rz-button-secondary-bg);
    color: var(--rz-button-secondary-fg);

    &:hover:not(:disabled) {
      @mixin hover;
    }
  }

  /** Link */
  .rz-button--link {
    background: var(--rz-button-link-bg);
    color: var(--rz-button-link-fg);
    text-underline-offset: 4px;

    &:hover:not(:disabled) {
      background-color: var(--rz-button-link-bg-hover);
      text-decoration: underline;
    }
  }

  /** Text */
  .rz-button--text {
    padding-left: 0;
    padding-right: 0;
    background-color: var(--rz-button-text-bg);
    color: var(--rz-button-text-fg);
    @mixin font-semibold;
    gap: var(--rz-size-2);

    &:hover {
      color: var(--rz-button-text-fg-hover);
    }

    &:disabled {
      color: var(--rz-button-text-fg-disabled);
    }
  }

  /**************************************/
  /* With Icon */
  /**************************************/

  .rz-button__icon,
  .rz-button--text__icon {
    display: grid;
    place-content: center;
    border-radius: var(--rz-radius-sm);
    height: var(--rz-size-5);
    width: var(--rz-size-5);
  }

  .rz-button--size-xs .rz-button__icon {
    display: grid;
    place-content: center;
    border-radius: var(--rz-radius-sm);
    height: var(--rz-size-2);
    width: var(--rz-size-2);
  }

  /* The key after the label, fainter: Confirm ↵ */
  .rz-button__kbd {
    display: inline-flex;
    margin-left: var(--rz-size-1);
    opacity: 0.5;
  }
</style>
