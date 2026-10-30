<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import './command-count.css';

  /** Under a list that holds the first of more matches: "20 of 143". Nothing when it holds all. */
  type Props = {
    shown: number;
    count: number | null;
  };
  const { shown, count }: Props = $props();
</script>

{#if count !== null && shown < count}
  <p class="rz-command-count">{t__('common.shown_of', String(shown), String(count))}</p>
{/if}
