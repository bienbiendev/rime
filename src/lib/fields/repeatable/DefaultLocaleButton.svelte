<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import { getLocaleContext } from '#lib/panel/context/locale.svelte.js';
  import Download from '@lucide/svelte/icons/download';

  type Props = { localized?: boolean; onclick: () => void };
  const { localized, onclick }: Props = $props();
  const locale = getLocaleContext();
</script>

<!-- Copies the field's value from the default locale; shown on a localized field in another locale. -->
{#if localized && locale && locale.code !== locale.defaultCode}
  <Button icon={Download} size="sm" variant="ghost" {onclick}>
    {t__('fields.get_data_from')}
    {locale.defaultCode}
  </Button>
{/if}
