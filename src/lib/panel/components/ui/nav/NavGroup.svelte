<script lang="ts">
  import { ChevronDown, type IconProps } from '@lucide/svelte';
  import type { Component, Snippet } from 'svelte';

  type Props = {
    children: Snippet;
    navCollapsed: boolean;
    name: string;
    icon: Component<IconProps> | null;
  };
  const { children, name, navCollapsed, icon }: Props = $props();

  let folded = $state(false);

  const toggleFolded = () => {
    folded = !folded;
    localStorage.setItem(`NavGroupCollapsed:${name}`, folded.toString());
  };

  $effect(() => {
    folded = localStorage.getItem(`NavGroupCollapsed:${name}`) === 'true';
  });
</script>

<div
  class="rz-nav-group"
  class:rz-nav-group--folded={folded && !navCollapsed}
  class:rz-nav-group--nav-collapsed={navCollapsed}
>
  {#if !navCollapsed}
    <button type="button" class="rz-nav-group__label" onclick={toggleFolded} aria-expanded={!folded}>
      {#if icon}
        {@const IconComp = icon}
        <IconComp size="12" />
      {/if}
      <span>{name}</span>
      <ChevronDown class="rz-nav-group__chevron" size="11" />
    </button>
  {/if}

  <div class="rz-nav-group__content">
    <div class="rz-nav-group__inner">
      {@render children()}
    </div>
  </div>
</div>

<style type="postcss">
  @import '../../../style/mixins/index.css';

  .rz-nav-group {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .rz-nav-group__label {
    display: flex;
    align-items: center;
    gap: var(--rz-size-1-5);
    height: var(--rz-size-7);
    padding: 0 var(--rz-size-2-5);
    border-radius: var(--rz-radius-md);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
    text-align: left;
    text-transform: capitalize;
    transition: color 0.15s;
    @mixin font-medium;

    &:hover {
      color: var(--rz-fg-muted);
    }
    &:focus-visible {
      @mixin focus-ring;
    }

    :global(.rz-nav-group__chevron) {
      opacity: 0;
      transition:
        opacity 0.15s,
        rotate 0.2s var(--ease-in-out-quart);
    }
    &:hover :global(.rz-nav-group__chevron),
    &:focus-visible :global(.rz-nav-group__chevron) {
      opacity: 1;
    }
  }

  .rz-nav-group__content {
    display: grid;
    grid-template-rows: 1fr;
    transition: grid-template-rows 0.3s var(--ease-in-out-quart);
  }

  .rz-nav-group__inner {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
  }

  .rz-nav-group--folded {
    .rz-nav-group__content {
      grid-template-rows: 0fr;
    }
    :global(.rz-nav-group__chevron) {
      opacity: 1;
      rotate: -90deg;
    }
  }

  .rz-nav-group--nav-collapsed {
    align-items: center;
    width: var(--rz-size-8);
    padding-top: var(--rz-size-1-5);
    border-top: 1px solid var(--rz-border);

    .rz-nav-group__inner {
      align-items: center;
    }
  }
</style>
