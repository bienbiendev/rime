<script lang="ts">
  import { env } from '$env/dynamic/public';
  import * as Tooltip from '$lib/panel/components/ui/tooltip';
  import { getUserContext } from '$lib/panel/context/user.svelte.js';
  import { authClient } from '$lib/panel/util/auth.js';
  import { LogOut } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import Button from '../button/button.svelte';

  type Props = { navCollapsed: boolean };
  const { navCollapsed }: Props = $props();

  const user = getUserContext();

  async function signout() {
    const result = await authClient.signOut();
    if (result.data?.success) {
      window.location.href = `${env.PUBLIC_RIME_URL}/panel/sign-in`;
    } else {
      toast.error(`Can't sign-out, please try again`);
    }
  }
</script>

<div class="rz-signout" class:rz-signout--nav-collapsed={navCollapsed}>
  {#if !navCollapsed}
    <div class="rz-user-button">
      <div class="rz-user-button__left">
        <a href="/panel/staff/{user.attributes.id}">
          {user.attributes.name?.charAt(0) || ''}
        </a>
        <div class="rz-user-button__name">{user.attributes.name}</div>
      </div>

      <Button onclick={signout} variant="ghost" size="icon-sm">
        <LogOut size="12" />
      </Button>
    </div>
  {:else}
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button {...props} onclick={signout} variant="ghost" size="icon-sm">
              <LogOut size="12" />
            </Button>
          {/snippet}
        </Tooltip.Trigger>

        <Tooltip.Content side="right">Logout</Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  {/if}
</div>

<style type="postcss">
  .rz-signout {
    :global(.rz-button[type='submit']) {
      width: var(--rz-size-10);
      height: var(--rz-size-10);
      padding: var(--rz-size-2);
      border-radius: var(--rz-radius-md);
    }
  }
  .rz-signout--nav-collapsed {
    display: flex;
    justify-content: center;
  }

  .rz-user-button {
    background-color: var(--rz-nav-button-bg);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-2);
    border-radius: var(--rz-radius-md);
    padding: var(--rz-size-2);
    height: var(--rz-input-height);
  }

  .rz-user-button__left {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--rz-size-2);
  }
  .rz-user-button__left a {
    background-color: light-dark(hsl(var(--rz-gray-15)), hsl(var(--rz-gray-0)));
    height: var(--rz-size-8);
    width: var(--rz-size-8);
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: var(--rz-radius-md);
    font-size: var(--rz-text-xs);
    text-transform: uppercase;
  }
  .rz-user-button__name {
    @mixin line-clamp 1;
  }
</style>
