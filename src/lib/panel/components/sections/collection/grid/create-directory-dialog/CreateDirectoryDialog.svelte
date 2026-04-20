<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { t__ } from '$lib/core/i18n/index.js';
  import { withDirectoriesSuffix } from '$lib/core/naming';
  import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import type { CollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import {
    setDocumentFormContext,
    type FormSuccessData
  } from '$lib/panel/context/documentForm.svelte.js';

  type Props = { collection: CollectionContext; open: boolean };
  let { collection, open = $bindable() }: Props = $props();

  let formElement = $state<HTMLFormElement>();
  const configCtx = getConfigContext();
  // svelte-ignore state_referenced_locally
  const directoriesConfig = configCtx.getCollection(withDirectoriesSuffix(collection.config.slug));
  // svelte-ignore state_referenced_locally
  const form = setDocumentFormContext({
    initial: {
      parent: collection.upload.currentPath
    },
    readOnly: false,
    config: directoriesConfig,
    key: withDirectoriesSuffix(collection.config.slug),
    beforeRedirect: beforeRedirect
  });

  // Prevent redirection after directory creation
  async function beforeRedirect(data?: FormSuccessData) {
    open = false;
    invalidateAll();
    return false;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="rz-status-dialog">
    {#snippet child({ props })}
      <form use:form.enhance bind:this={formElement} {...props}>
        <Dialog.Header>{t__('common.create_folder')}</Dialog.Header>
        <RenderFields {form} fields={directoriesConfig.fields} />
        <Dialog.Footer --rz-justify-content="space-between">
          <Button data-submit disabled={!form.canSubmit} type="submit">
            {t__('common.create')}
          </Button>
          <Button variant="secondary" onclick={() => (open = false)}>Cancel</Button>
        </Dialog.Footer>
      </form>
    {/snippet}
  </Dialog.Content>
</Dialog.Root>
