<script lang="ts">
  import type { HTMLAnchorAttributes } from 'svelte/elements';

  type Props = HTMLAnchorAttributes & {
    icon?: any;
    active?: boolean;
  };

  let { class: className, active = false, icon, children, ...restProps }: Props = $props();
</script>

<a
  class="rz-nav-item {className}"
  class:rz-nav-item--active={active}
  aria-current={active ? 'page' : undefined}
  {...restProps}
>
  {#if icon}
    {@const IconProp = icon}
    <IconProp size="15" />
  {/if}
  {#if children}
    <span class="rz-nav-item__label">{@render children()}</span>
  {/if}
</a>

<style type="postcss">
  @import '../../../style/mixins/index.css';

  .rz-nav-item {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--rz-size-2-5);
    width: 100%;
    height: var(--rz-size-8);
    padding: 0 var(--rz-size-2-5);
    border-radius: var(--rz-radius-lg);
    color: var(--rz-fg-muted);
    white-space: nowrap;
    transition:
      background-color 0.15s,
      color 0.15s;

    :global(svg) {
      flex-shrink: 0;
      color: var(--rz-fg-subtle);
      transition: color 0.15s;
    }

    &:hover {
      background-color: var(--rz-bg-hover);
      color: var(--rz-fg);
      :global(svg) {
        color: var(--rz-fg);
      }
    }
    &:focus-visible {
      @mixin focus-ring;
      outline-offset: -2px;
    }
  }

  .rz-nav-item--active {
    background-color: var(--rz-bg-active);
    color: var(--rz-fg);
    @mixin font-medium;

    :global(svg) {
      color: var(--rz-fg);
    }
  }

  .rz-nav-item__label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
