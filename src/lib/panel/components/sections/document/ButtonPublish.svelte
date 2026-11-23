<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
  import { getAPIProxyContext } from '#lib/panel/context/api-proxy.svelte.js';
  import type { DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
  import Button from '../../ui/button/button.svelte';
  import { setVersionStatus } from './version-status.js';

  type Props = { form: DocumentFormContext };
  const { form }: Props = $props();

  const APIProxy = getAPIProxyContext();

  /** Unsaved changes, or an auto-saved row: Publish saves them. */
  const pending = $derived(Object.keys(form.changes).length > 0 || !!form.values.isAutoSave);
</script>

<!--
  Publishes the draft on screen. With something to save, it submits the form as the published
  version; with nothing, it sets the status of the row on screen.
-->
{#if pending}
  <Button
    size="sm"
    type="submit"
    disabled={!form.canSubmit}
    data-status={VERSIONS_STATUS.PUBLISHED}
  >
    {t__('common.publish')}
  </Button>
{:else}
  <Button
    size="sm"
    disabled={form.readOnly}
    onclick={() => setVersionStatus(form, APIProxy, VERSIONS_STATUS.PUBLISHED)}
  >
    {t__('common.publish')}
  </Button>
{/if}
