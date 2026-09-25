<script lang="ts">
  import { dev } from '$app/environment';
  import { t__ } from '$lib/core/i18n/index.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import * as DropdownMenu from '$lib/panel/components/ui/dropdown-menu/index.js';
  import { useCommands } from '$lib/panel/context/commands.svelte.js';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { Languages } from '@lucide/svelte';
  import Cookies from 'js-cookie';

  type Props = { onLocalClick: (code: string) => void };
  const { onLocalClick }: Props = $props();

  const locale = getLocaleContext();
  const config = getConfigContext();
  const locales = $state(config.raw.localization?.locales || []);

  function isActive(code: string) {
    return code === locale.code;
  }

  function switchTo(code: string) {
    Cookies.set('rime.locale', code, { sameSite: 'strict', secure: !dev });
    onLocalClick(code);
  }

  /** The other locales, in the palette. */
  useCommands(() =>
    locales
      .filter((item) => !isActive(item.code))
      .map((item) => ({
        id: `locale.${item.code}`,
        label: t__('common.switch_to_language', item.label),
        group: t__('common.language'),
        icon: Languages,
        run: () => switchTo(item.code)
      }))
  );
</script>

{#if config.raw.localization?.locales.length}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button icon={Languages} size="sm" aria-label={locale.label} variant="secondary" {...props}>
          {locale.code?.toUpperCase()}
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>

    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end">
        {#each locales as item, index (index)}
          <DropdownMenu.Item
            disabled={isActive(item.code)}
            data-active={isActive(item.code) ? '' : null}
            onclick={() => switchTo(item.code)}
          >
            <span>{item.label}</span>
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
{/if}
