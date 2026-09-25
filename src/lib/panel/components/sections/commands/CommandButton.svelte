<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { getCommandsContext } from '$lib/panel/context/commands.svelte.js';
  import { isMac } from '$lib/panel/util/keys.js';
  import { Command } from '@lucide/svelte';
  import Button from '../../ui/button/button.svelte';

  const commands = getCommandsContext();
  const mac = isMac();
</script>

<!-- The key, and a way in for whoever does not know it. -->
<Button
  class="rz-command-button"
  aria-label={t__('common.commands')}
  variant="outline"
  size="sm"
  onclick={() => commands?.palette.show()}
>
  {#if mac}<Command size="10" />{:else}Ctrl{/if}
  K
</Button>
