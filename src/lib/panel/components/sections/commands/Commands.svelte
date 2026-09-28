<script lang="ts">
  import { setCommandsContext } from '$lib/panel/context/commands.svelte.js';
  import type { Route } from '$lib/panel/types.js';
  import type { Snippet } from 'svelte';
  import CommandPalette from './CommandPalette.svelte';

  type Props = { routes?: Record<string, Route[]>; children: Snippet };
  const { routes = {}, children }: Props = $props();

  const commands = setCommandsContext();
</script>

<!-- Every key of the panel comes here, and the one palette lives here. -->
<svelte:window onkeydown={commands.dispatch} />

<CommandPalette {routes} />

{@render children()}
