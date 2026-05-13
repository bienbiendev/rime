<script lang="ts">
  import { ChevronUp, type IconProps } from '@lucide/svelte';
  import type { Component, Snippet } from 'svelte';

  type Props = {
    children: Snippet;
    navCollapsed: boolean;
    name: string;
    icon: Component<IconProps> | null;
  };
  const { children, name, navCollapsed, icon }: Props = $props();

  let groupCollapsed = $state(false);

  const setCollapsed = () => {
    groupCollapsed = !groupCollapsed;
    localStorage.setItem(`NavGroupCollapsed:${name}`, groupCollapsed.toString());
  };

  $effect(() => {
    groupCollapsed = localStorage.getItem(`NavGroupCollapsed:${name}`) === 'true';
  });

  const navCollapsedClassModifier = $derived(navCollapsed ? 'rz-nav-group--nav-collapsed' : '');
  const groupCollapsedClassModifier = $derived(groupCollapsed ? 'rz-nav-group--collapsed' : '');
</script>

<div class="rz-nav-group {navCollapsedClassModifier} {groupCollapsedClassModifier}">
  {#if !navCollapsed}
    <button onclick={setCollapsed} class="rz-nav-group__trigger">
      <span>
        {#if icon}
          {@const IconComp = icon}
          <IconComp size="15" />
        {/if}
        {name}
      </span>
      <ChevronUp class="rz-nav-group__chevron" size="12" />
    </button>
  {/if}

  <div class="rz-nav-group__content">
    <div class="rz-nav-group__content-inner">
      {@render children()}
    </div>
  </div>
</div>

<style type="postcss" global>
  .rz-nav-group {
    width: 100%;
    position: sticky;
    top: 0;
    z-index: 20;
    margin-bottom: var(--rz-size-2);
    background-color: var(--rz-nav-button-bg);
    border-radius: var(--rz-radius-lg);

    :global {
      .rz-nav-group__chevron {
        transition: transform 0.3s var(--ease-in-out-quart);
      }
    }
  }

  .rz-nav-group__content {
    display: grid;
    grid-template-rows: 1fr;
    padding: 0 var(--rz-size-4);
    background-color: var(--rz-nav-group-bg);
    border-bottom-left-radius: var(--rz-radius-lg);
    border-bottom-right-radius: var(--rz-radius-lg);
    transition: grid-template-rows 0.3s var(--ease-in-out-quart);
  }

  .rz-nav-group__content-inner {
    overflow: hidden;
    display: grid;
  }

  .rz-nav-group__trigger {
    padding: var(--rz-size-3);
    display: flex;
    width: 100%;
    height: var(--rz-input-height);
    gap: var(--rz-size-2);
    align-items: center;
    text-transform: capitalize;
    justify-content: space-between;
    text-align: left;
    border-bottom: 1px solid var(--rz-nav-group-border-color);
    transition: border-color 0.3s var(--ease-in-out-quart);

    span {
      display: flex;
      align-items: center;
      gap: var(--rz-size-3);
    }
  }

  .rz-nav-group.rz-nav-group--collapsed:not(.rz-nav-group--nav-collapsed) {
    .rz-nav-group__trigger {
      border-color: transparent;
    }

    .rz-nav-group__content {
      grid-template-rows: 0fr;
    }
    :global {
      .rz-nav-group__chevron {
        transform: rotate(180deg);
      }
    }
  }

  .rz-nav-group--nav-collapsed {
    background-color: transparent;
    .rz-nav-group__content {
      background-color: transparent;
      padding: 0 var(--rz-size-2);
    }
  }
</style>
