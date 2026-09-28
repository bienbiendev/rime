<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import type { IconProps } from '@lucide/svelte';
  import type { Component, Snippet } from 'svelte';

  type Props = {
    href: ResolvedPathname;
    title: string;
    icon?: Component<IconProps>;
    /** Before the title, in place of an icon: an avatar. */
    lead?: Snippet;
    description?: string | null;
    /** After the title: a status, a role, a date. */
    children?: Snippet;
  };
  const { href, title, icon: Icon, lead, description, children }: Props = $props();
</script>

<li>
  <a class="rz-dashboard-row" {href}>
    {#if lead}
      {@render lead()}
    {:else if Icon}
      <Icon size={14} aria-hidden="true" />
    {/if}
    <span class="rz-dashboard-row__text">
      <span class="rz-dashboard-row__title">{title}</span>
      {#if description}
        <span class="rz-dashboard-row__description">{description}</span>
      {/if}
    </span>
    {@render children?.()}
  </a>
</li>

<style type="postcss">
  @import '../../style/mixins/index.css';

  .rz-dashboard-row {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2-5);
    min-height: --size(9.5);
    padding: var(--rz-size-1-5) var(--rz-size-3-5);
    box-shadow: inset 0 1px 0 var(--rz-border);

    &:hover {
      background-color: var(--rz-bg-hover);
    }

    &:focus-visible {
      outline: none;
      box-shadow:
        inset 0 1px 0 var(--rz-border),
        inset 0 0 0 2px var(--rz-accent-border);
    }

    > :global(svg) {
      flex-shrink: 0;
      color: var(--rz-fg-subtle);
    }
  }

  .rz-dashboard-row__text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .rz-dashboard-row__title,
  .rz-dashboard-row__description {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rz-dashboard-row__description {
    color: var(--rz-fg-subtle);
  }
</style>
