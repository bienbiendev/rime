<script lang="ts">
  import { panelUrl } from '$lib/core/routes/util.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import * as DropdownMenu from '$lib/panel/components/ui/dropdown-menu/index.js';
  import { getUserContext } from '$lib/panel/context/user.svelte.js';
  import { authClient } from '$lib/panel/util/auth.js';
  import { ChevronsUpDown, LogOut, UserRound } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';

  type Props = { navCollapsed: boolean };
  const { navCollapsed }: Props = $props();

  const user = getUserContext();

  // "Anthony Ivol" -> "AI"
  const initials = $derived(
    (user.attributes.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
  );
  const role = $derived(user.attributes.roles?.[0]);

  async function signout() {
    const result = await authClient.signOut();
    if (result.data?.success) {
      window.location.href = panelUrl('sign-in');
    } else {
      toast.error(`Can't sign-out, please try again`);
    }
  }
</script>

<!-- The signed-in user; a menu leads to their profile and signs them out. -->
<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <button
        {...props}
        type="button"
        class="rz-user"
        class:rz-user--nav-collapsed={navCollapsed}
        aria-label={user.attributes.name}
      >
        <span class="rz-user__avatar">{initials}</span>
        {#if !navCollapsed}
          <span class="rz-user__name">
            {user.attributes.name}
            {#if role}<small>{role}</small>{/if}
          </span>
          <ChevronsUpDown class="rz-user__chevrons" size="14" />
        {/if}
      </button>
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Portal>
    <DropdownMenu.Content side="top" align="start" sideOffset={6} class="rz-user__menu">
      <DropdownMenu.Item>
        {#snippet child({ props })}
          <a {...props} href={panelUrl('staff', user.attributes.id)}>
            <UserRound size="14" />
            {t__('common.profile')}
          </a>
        {/snippet}
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item onclick={signout}>
        <LogOut size="14" />
        {t__('common.sign_out')}
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

<style type="postcss">
  @import '../../../style/mixins/index.css';

  .rz-user {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--rz-size-2-5);
    width: 100%;
    height: var(--rz-size-10);
    padding: 0 var(--rz-size-2) 0 var(--rz-size-1-5);
    border-radius: var(--rz-radius-lg);
    color: var(--rz-fg);
    text-align: left;
    transition: background-color 0.15s;

    &:hover,
    &[data-state='open'] {
      background-color: var(--rz-bg-hover);
    }
    &:focus-visible {
      @mixin focus-ring;
      outline-offset: -2px;
    }

    :global(.rz-user__chevrons) {
      flex-shrink: 0;
      color: var(--rz-fg-subtle);
    }
  }

  .rz-user--nav-collapsed {
    justify-content: center;
    width: var(--rz-size-8);
    height: var(--rz-size-8);
    padding: 0;
  }

  .rz-user__avatar {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: var(--rz-size-7);
    height: var(--rz-size-7);
    border-radius: var(--rz-radius-full);
    background-color: var(--rz-bg-well);
    box-shadow: inset 0 0 0 1px var(--rz-border);
    color: var(--rz-fg-muted);
    font-size: var(--rz-text-xs);
    text-transform: uppercase;
    @mixin font-semibold;
  }

  .rz-user__name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    @mixin font-medium;

    small {
      margin-left: var(--rz-size-1);
      color: var(--rz-fg-subtle);
      font-size: var(--rz-text-sm);
      text-transform: capitalize;
      @mixin font-normal;
    }
  }

  :global(.rz-user__menu) {
    min-width: var(--rz-size-48);
  }
</style>
