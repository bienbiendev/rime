<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { getCommandsContext } from '$lib/panel/context/commands.svelte.js';
  import { Search } from '@lucide/svelte';
  import Button from '../../ui/button/button.svelte';
  import Kbd from '../../ui/kbd/Kbd.svelte';

  /**
   * `kbd` is the key alone; `input` is the key in something that looks like a search box;
   * `icon` is the search box folded to its magnifier.
   */
  type Props = { variant?: 'kbd' | 'input' | 'icon' };
  const { variant = 'kbd' }: Props = $props();

  const commands = getCommandsContext();
</script>

<!-- The key, and a way in for whoever does not know it. -->
{#if variant === 'input' || variant === 'icon'}
  <button
    type="button"
    class="rz-cmdk-input"
    class:rz-cmdk-input--icon={variant === 'icon'}
    aria-label={t__('common.commands')}
    onclick={() => commands?.palette.show()}
  >
    <Search size="15" />
    {#if variant === 'input'}
      <span class="rz-cmdk-input__label">{t__('common.type_a_command')}</span>
      <Kbd keys="mod+k" />
    {/if}
  </button>
{:else}
  <Button
    class="rz-cmdk"
    aria-label={t__('common.commands')}
    variant="ghost"
    size="sm"
    onclick={() => commands?.palette.show()}
  >
    <Kbd keys="mod+k" plain />
  </Button>
{/if}

<style lang="postcss">
  @import '../../../style/mixins/index.css';

  .rz-cmdk-input {
    @mixin well;
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    width: 100%;
    height: var(--rz-size-8);
    padding: 0 var(--rz-size-1-5) 0 var(--rz-size-2-5);
    border-radius: var(--rz-radius-lg);
    color: var(--rz-fg-subtle);
    text-align: left;
    transition: color 0.15s;

    &:hover {
      color: var(--rz-fg-muted);
    }
    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-cmdk-input--icon {
    justify-content: center;
    width: var(--rz-size-8);
    padding: 0;
  }

  .rz-cmdk-input__label {
    flex: 1;
    overflow: hidden;
    font-size: var(--rz-text-md);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
