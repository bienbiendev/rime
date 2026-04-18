<script lang="ts">
  import type { Props } from './index.js';

  let {
    class: className,
    variant = 'default',
    size = 'default',
    ref = $bindable(null),
    href = undefined,
    type = 'button',
    icon,
    children,
    ...restProps
  }: Props = $props();
</script>

{#snippet iconProp()}
  {#if icon}
    {@const IconProp = icon}
    {#if variant === 'text'}
      <div class="rz-button--text__icon">
        <IconProp size="15" strokeWidth="2px" />
      </div>
    {:else}
      <div class="rz-button__icon">
        <IconProp size="14" strokeWidth="2px" />
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
    {...restProps}
  >
    {@render iconProp()}
    {@render children?.()}
  </button>
{/if}

<style type="postcss">
  @import '../../../style/mixins/index.css';

  :root {
    --rz-button-tl-radius: var(--rz-radius-md);
    --rz-button-tr-radius: var(--rz-radius-md);
    --rz-button-br-radius: var(--rz-radius-md);
    --rz-button-bl-radius: var(--rz-radius-md);

    /* Default variant */
    --rz-button-default-bg: light-dark(hsl(var(--rz-gray-0)), hsl(var(--rz-gray-15)));
    --rz-button-default-bg-hover: light-dark(hsl(var(--rz-gray-2)), hsl(var(--rz-gray-19)));
    --rz-button-default-bg-disabled: light-dark(hsl(var(--rz-gray-3)), hsl(var(--rz-gray-12)));
    --rz-button-default-fg: light-dark(hsl(var(--rz-gray-13)), hsl(var(--rz-gray-2)));

    /* Success variant */
    --rz-button-success-bg: hsl(var(--rz-color-spot) / 1);
    --rz-button-success-bg-hover: hsl(var(--rz-color-spot) / 0.6);
    --rz-button-success-bg-disabled: hsl(var(--rz-color-spot) / 0.3);
    --rz-button-success-fg: hsl(var(--rz-color-spot-fg) / 1);

    /* Outline variant */
    --rz-button-outline-bg: transparent;
    --rz-button-outline-fg: light-dark(hsl(var(--rz-gray-4)), hsl(var(--rz-gray-12)));
    --rz-button-outline-border: light-dark(hsl(var(--rz-gray-14)), hsl(var(--rz-gray-8)));
    --rz-button-outline-bg-hover: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-4)));
    /* border-width */
    --rz-button-outline-border-left-width: 1px;
    --rz-button-outline-border-top-width: 1px;
    --rz-button-outline-border-right-width: 1px;
    --rz-button-outline-border-bottom-width: 1px;

    /* Ghost variant */
    --rz-button-ghost-bg: transparent;
    --rz-button-ghost-bg-hover: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-4)));
    --rz-button-ghost-fg: hsl(var(--rz-color-fg));

    /* Secondary variant */
    --rz-button-secondary-bg: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-3)));
    --rz-button-secondary-bg-hover: light-dark(
      hsl(var(--rz-gray-16)),
      color-mix(in hsl, white 3%, hsl(var(--rz-gray-3)))
    );
    --rz-button-secondary-fg: hsl(var(--rz-color-fg));

    /* Link variant */
    --rz-button-link-bg: transparent;
    --rz-button-link-bg-hover: transparent;
    --rz-button-link-fg: hsl(var(--rz-color-fg));

    /* Text variant */
    --rz-button-text-bg: transparent;
    --rz-button-text-fg: hsl(var(--rz-color-fg) / 0.6);
    --rz-button-text-fg-hover: hsl(var(--rz-color-fg) / 1);
    --rz-button-text-fg-disabled: hsl(var(--rz-color-fg) / 0.4);
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
      box-shadow, color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-duration: 0.25s;
    gap: var(--rz-size-2);
    fill: currentColor;
  }

  .rz-button:focus-visible {
    /* --rz-ring-offset: 1px; */
    outline: none;
    @mixin ring var(--rz-color-ring);
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
    border-radius: var(--rz-radius-md);
  }

  .rz-button--size-sm {
    font-size: var(--rz-text-md);
    height: var(--rz-size-8);
    padding: var(--rz-size-2) var(--rz-size-3);
    border-radius: var(--rz-radius-md);
  }

  .rz-button--size-lg {
    font-size: var(--rz-text-md);
    height: var(--rz-size-12);
    padding: var(--rz-size-2) var(--rz-size-8);
    border-radius: var(--rz-radius-md);
  }

  .rz-button--size-xl {
    height: var(--rz-size-14);
    font-size: var(--rz-text-md);
    padding: var(--rz-size-2) var(--rz-size-8);
    border-radius: var(--rz-radius-md);
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
    background-color: var(--rz-button-default-bg);
    color: var(--rz-button-default-fg);
    &:hover:not(:disabled) {
      background-color: var(--rz-button-default-bg-hover);
    }
    &:disabled {
      background-color: var(--rz-button-default-bg-disabled);
    }
  }

  /** Success */
  .rz-button--success {
    background-color: var(--rz-button-success-bg);
    color: var(--rz-button-success-fg);
    &:hover {
      background-color: var(--rz-button-success-bg-hover);
    }
    &:disabled:not(:disabled) {
      background-color: var(--rz-button-success-bg-disabled);
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
      /* border-color: var(--rz-button-outline-border-hover); */
      background-color: var(--rz-button-outline-bg-hover);
    }
  }

  /** Ghost */
  .rz-button--ghost {
    background-color: var(--rz-button-ghost-bg);
    color: var(--rz-button-ghost-fg);

    &:hover:not(:disabled) {
      background-color: var(--rz-button-ghost-bg-hover);
    }
  }

  /** Secondary */
  .rz-button--secondary {
    background-color: var(--rz-button-secondary-bg);
    color: var(--rz-button-secondary-fg);

    &:hover:not(:disabled) {
      background-color: var(--rz-button-secondary-bg-hover);
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
</style>
