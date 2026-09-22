<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { PARAMS } from '$lib/core/constants.js';
  import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant.js';
  import { apiUrl } from '$lib/core/routes/util.js';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import * as Radio from '$lib/panel/components/ui/radio-group/index.js';
  import { getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import { useCommands } from '$lib/panel/context/commands.svelte.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { toKebabCase } from '$lib/util/string';
  import { toast } from 'svelte-sonner';
  import { t__ } from '../../../../core/i18n/index.js';
  import Button from '../../ui/button/button.svelte';
  import Label from '../../ui/label/label.svelte';
  import StatusDot from '../collection/StatusDot.svelte';
  type Props = { form: DocumentFormContext };
  const { form }: Props = $props();

  const APIProxy = getAPIProxyContext();
  const statusList = Object.values(VERSIONS_STATUS);

  let dialogOpen = $state(false);

  async function handleValidateStatus(next: string = status) {
    const urlId = form.values._prototype === 'collection' ? `/${form.values.id}` : '/';
    await fetch(
      `${apiUrl(toKebabCase(form.values._type))}${urlId}?${PARAMS.VERSION_ID}=${form.values.versionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: next
        })
      }
    )
      .then((r) => {
        if (r.status === 200) {
          toast.success(t__('common.doc_updated'));
          // The server holds the new status already: the form takes it without getting dirty,
          // so no auto-save follows a publish.
          form.sync('status', next);
          dialogOpen = false;
          invalidateAll();
          // The write went around the form: the version history re-reads its statuses.
          APIProxy.invalidate(form.config.slug);
        } else {
          toast.error(t__('error.generic'));
        }
      })
      .catch(() => {
        toast.error(t__('error.generic'));
      });
  }

  let status = $derived(form.values.status);

  /** The other statuses, one line each. */
  useCommands(() =>
    statusList
      .filter((candidate) => candidate !== form.values.status)
      .map((candidate) => ({
        id: `document.status.${candidate}`,
        label: t__('common.mark_as', t__(`common.${candidate}`)),
        group: t__('common.document'),
        run: () => handleValidateStatus(candidate)
      }))
  );
</script>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Trigger>
    {#snippet child(props)}
      <Button size="sm" variant="secondary" onclick={() => (dialogOpen = true)} {...props}>
        <StatusDot status={form.values.status} />
        <p class="rz-status__text">{t__(`common.${form.values.status}`)}</p>
      </Button>
    {/snippet}
  </Dialog.Trigger>
  <Dialog.Content class="rz-status-dialog">
    <Radio.Root bind:value={status}>
      {#each statusList as status, index (index)}
        <div class="rz-radio__option">
          <Radio.Item id="document.{status}" value={status} />
          <Label for="document.{status}">
            {t__(`common.${status}`)}<br />
            <p>{t__(`common.${status}_infos`)}</p>
          </Label>
        </div>
      {/each}
    </Radio.Root>
    <Dialog.Footer --rz-justify-content="space-between">
      <Button onclick={() => handleValidateStatus()} variant="outline">Validate</Button>
      <Button onclick={() => (dialogOpen = false)} variant="secondary">Cancel</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style lang="postcss">
  @import '../../../style/mixins/index.css';

  .rz-radio__option {
    display: flex;
    gap: var(--rz-size-3);
    padding: var(--rz-size-3);
    border: var(--rz-border);
  }
  :global {
    .rz-dialog-footer button {
      flex: 1;
    }
  }
  p {
    @mixin font-normal;
  }
</style>
