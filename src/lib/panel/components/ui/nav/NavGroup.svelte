<script lang="ts">
  import { ChevronDown, ChevronUp, type IconProps } from '@lucide/svelte';
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
      {#if groupCollapsed}
        <ChevronDown size="12" />
      {:else}
        <ChevronUp size="12" />
      {/if}
    </button>
  {/if}
  {#if !groupCollapsed || navCollapsed}
    <div class="rz-nav-group__content">
      {@render children()}
    </div>
  {/if}
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
  }

  .rz-nav-group__content {
    display: grid;
    padding: 0 var(--rz-size-4);
    background-color: var(--rz-nav-group-bg);
    border-bottom-left-radius: var(--rz-radius-lg);
    border-bottom-right-radius: var(--rz-radius-lg);
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

    span {
      display: flex;
      align-items: center;
      gap: var(--rz-size-3);
    }
  }

  .rz-nav-group--collapsed {
    .rz-nav-group__trigger {
      border-color: transparent;
    }
  }

  .rz-nav-group--nav-collapsed {
    /*padding-top: var(--rz-size-2);*/
    .rz-nav-group__content {
      background-color: transparent;
      padding: 0 var(--rz-size-5);
    }
  }
</style>
