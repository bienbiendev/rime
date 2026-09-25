<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { getCommandsContext } from '$lib/panel/context/commands.svelte.js';
  import { isMac } from '$lib/panel/util/keys.js';
  import { Command, Search } from '@lucide/svelte';
  import Button from '../../ui/button/button.svelte';

  /** `kbd` is the key alone; `input` is the key in something that looks like a search box. */
  type Props = { variant?: 'kbd' | 'input' };
  const { variant = 'kbd' }: Props = $props();

  const commands = getCommandsContext();
  const mac = isMac();
</script>

{#snippet keys()}
  {#if mac}<Command size="10" />{:else}Ctrl{/if}
  K
{/snippet}

<!-- The key, and a way in for whoever does not know it. -->
{#if variant === 'input'}
  <button
    type="button"
    class="rz-command-input"
    aria-label={t__('common.commands')}
    onclick={() => commands?.palette.show()}
  >
    <Search size="13" />
    <span class="rz-command-input__label">{t__('common.type_a_command')}</span>
    <kbd>{@render keys()}</kbd>
  </button>
{:else}
  <Button
    class="rz-command-button"
    aria-label={t__('common.commands')}
    variant="outline"
    size="sm"
    onclick={() => commands?.palette.show()}
  >
    {@render keys()}
  </Button>
{/if}

<style lang="postcss">
  .rz-command-input {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    width: var(--rz-size-80);
    max-width: 100%;
    height: var(--rz-size-9);
    padding-inline: var(--rz-size-3);
    border: var(--rz-border);
    border-radius: var(--rz-radius-md);
    background-color: hsl(var(--rz-input-bg));
    color: hsl(var(--rz-color-fg) / 0.5);

    &:hover {
      color: hsl(var(--rz-color-fg) / 0.7);
    }

    kbd {
      display: flex;
      align-items: center;
      gap: var(--rz-size-1);
      font-size: var(--rz-text-xs);
    }
  }

  .rz-command-input__label {
    flex: 1;
    overflow: hidden;
    font-size: var(--rz-text-sm);
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
