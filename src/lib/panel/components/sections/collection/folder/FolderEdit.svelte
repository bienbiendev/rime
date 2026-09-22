<script lang="ts">
  import type { BuiltCollectionClient } from '$lib/core/config/types';
  import { t__ } from '$lib/core/i18n/index.js';
  import { withDirectoriesSuffix } from '$lib/core/prototype/collection/upload/naming.js';
  import type { Directory } from '$lib/core/prototype/collection/upload/types';
  import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import { useCommands } from '$lib/panel/context/commands.svelte.js';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { setDocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getUserContext } from '$lib/panel/context/user.svelte.js';

  type Props = {
    open: boolean;
    folder: Directory;
    collection: BuiltCollectionClient;
  };
  let { folder, collection, open = $bindable() }: Props = $props();

  let formElement = $state<HTMLFormElement>();
  const user = getUserContext();
  const configCtx = getConfigContext();
  // svelte-ignore state_referenced_locally
  const config = configCtx.getCollection(withDirectoriesSuffix(collection.slug));
  // svelte-ignore state_referenced_locally
  const form = setDocumentFormContext({
    initial: folder,
    config,
    readOnly: !config.access.update(user.attributes, { id: folder.id }),
    key: folder._type,
    afterSuccess: () => (open = false)
  });

  /** ⌘S while the dialog is up. */
  useCommands(() => [
    {
      id: 'folder.save',
      label: t__('common.save'),
      keys: 'mod+s',
      inField: true,
      hidden: true,
      when: () => open,
      run: submit
    }
  ]);

  function submit() {
    if (!formElement) throw Error('formElement is not defined');
    if (!form.canSubmit) return;
    const saveButton = formElement.querySelector('button[data-submit]');
    if (saveButton) formElement.requestSubmit(saveButton as HTMLButtonElement);
    else formElement.requestSubmit();
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    {#snippet child({ props })}
      <form use:form.enhance bind:this={formElement} {...props}>
        <RenderFields {form} fields={config.fields} />
        <Dialog.Footer --rz-justify-content="space-between">
          <Button data-submit disabled={!form.canSubmit} type="submit">{t__('common.save')}</Button>
          <Button onclick={() => (open = false)} variant="secondary">{t__('common.cancel')}</Button>
        </Dialog.Footer>
      </form>
    {/snippet}
  </Dialog.Content>
</Dialog.Root>
