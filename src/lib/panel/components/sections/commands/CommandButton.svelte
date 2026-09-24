<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { getCommandsContext } from '$lib/panel/context/commands.svelte.js';
  import { isMac } from '$lib/panel/util/keys.js';
  import { Command } from '@lucide/svelte';

  const commands = getCommandsContext();
  const mac = isMac();
</script>

<!-- The key, and a way in for whoever does not know it. -->
<button
  type="button"
  class="rz-command-button"
  aria-label={t__('common.commands')}
  onclick={() => commands?.palette.show()}
>
  <kbd>
    {#if mac}<Command size="10" />{:else}Ctrl{/if}
    K
  </kbd>
</button>

<style lang="postcss">
  .rz-command-button {
    display: flex;
    kbd {
      display: flex;
      gap: var(--rz-size-1);
      align-items: center;
      border: var(--rz-border);
      border-radius: var(--rz-radius-sm);
      padding: 0 var(--rz-size-2);
      font-size: var(--rz-text-xs);
      line-height: var(--rz-size-5);
      min-width: var(--rz-size-5);
      color: hsl(var(--rz-color-fg) / 0.6);
    }
    &:hover kbd {
      color: hsl(var(--rz-color-fg));
    }
  }
</style>
