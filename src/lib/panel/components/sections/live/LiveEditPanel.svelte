<script lang="ts">
  import { getFieldListAtPath } from '$lib/core/fields/util.js';
  import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { setDocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getLivePanelContext } from '$lib/panel/context/livePanel.svelte.js';
  import type { GenericDoc } from '$lib/types';
  import { onMount } from 'svelte';
  import ScrollArea from '../../ui/scroll-area/scroll-area.svelte';
  import './live-edit-panel.css';

  type Props = {
    doc: GenericDoc;
    onDataChange: any;
    afterSuccess: (savedDoc: any) => void;
    onFormReady: (form: any) => void;
  };

  const { doc, onDataChange, afterSuccess, onFormReady }: Props = $props();

  // fieldPath comes from the centralized panel context — reactive when user navigates the stack
  const livePanelCtx = getLivePanelContext();
  const fieldPath = $derived(livePanelCtx.activePanel?.fieldPath ?? '');

  const { getDocumentConfig } = getConfigContext();
  // svelte-ignore state_referenced_locally
  const docConfig = getDocumentConfig({ prototype: doc._prototype, slug: doc._type });

  // Form context is created once and kept alive — switching fieldPath only changes what's rendered
  // svelte-ignore state_referenced_locally
  const form = setDocumentFormContext({
    initial: doc,
    config: docConfig,
    readOnly: false,
    onDataChange,
    afterSuccess,
    key: `${doc._type}_0`
  });

  // Register form with parent after mount so parent can drive save/revert
  onMount(() => onFormReady(form));

  // Reactive: re-derives when fieldPath changes (no remount needed)
  const { fields, path } = $derived(getFieldListAtPath(fieldPath, docConfig.fields));
</script>

<form class="rz-live-edit-panel" use:form.enhance enctype="multipart/form-data" method="post">
  <ScrollArea class="rz-live-edit-panel__fields">
    {#key doc.id + (doc.versionId || '') + (doc.locale || '')}
      <RenderFields {fields} {path} {form} />
    {/key}
  </ScrollArea>
</form>
