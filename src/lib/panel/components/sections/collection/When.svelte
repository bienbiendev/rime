<script lang="ts">
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { formatWhen } from '$lib/panel/util/time.js';

  type Props = {
    date: Date | string;
    /** The moment "ago" counts from; the render's by default. */
    now?: Date;
  };
  const { date, now = new Date() }: Props = $props();

  const config = getConfigContext();
  const iso = $derived(new Date(date).toISOString());
  const label = $derived(formatWhen(date, now, config.raw.panel.language));
</script>

<!-- 2 h ago, Yesterday, Sep 12: the full date shows on hover. -->
<time
  class="rz-when"
  datetime={iso}
  title={new Date(date).toLocaleString(config.raw.panel.language)}
>
  {label}
</time>

<style lang="postcss">
  .rz-when {
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
