<script lang="ts">
  import type { User } from '$lib/core/collections/auth/types.js';
  import type { BuiltConfigClient } from '$lib/core/config/types.js';
  import { getFieldBuildersAtPath } from '$lib/core/fields/util.js';
  import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
  import { setAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import { getConfigContext, setConfigContext } from '$lib/panel/context/config.svelte.js';
  import { setDocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getLivePanelContext } from '$lib/panel/context/livePanel.svelte.js';
  import { setLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { setTitleContext } from '$lib/panel/context/title';
  import { setUserContext } from '$lib/panel/context/user.svelte.js';
  import { onMount } from 'svelte';
  import ScrollArea from '../../ui/scroll-area/scroll-area.svelte';
  import './live-edit-panel.css';

  type Props = {
    doc: any;
    locale: string | undefined;
    config: BuiltConfigClient;
    onDataChange: any;
    afterSuccess: (savedDoc: any) => void;
    onFormReady: (form: any) => void;
    user: User;
  };

  const {
    doc,
    config,
    locale: initialLocale,
    user,
    onDataChange,
    afterSuccess,
    onFormReady
  }: Props = $props();

  // fieldPath comes from the centralized panel context — reactive when user navigates the stack
  const livePanelCtx = getLivePanelContext();
  const fieldPath = $derived(livePanelCtx.activePanel?.fieldPath ?? '');

  // Contexts are set once — component stays mounted for the lifetime of the live session
  setAPIProxyContext();
  // svelte-ignore state_referenced_locally
  setConfigContext(config);
  // svelte-ignore state_referenced_locally
  setUserContext(user);
  // svelte-ignore state_referenced_locally
  setLocaleContext(initialLocale);
  setTitleContext('[untitled]');

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
    key: `live_edit_${doc._type}_${doc.id ?? 'area'}`
  });

  // Register form with parent after mount so parent can drive save/revert
  onMount(() => onFormReady(form));

  // Reactive: re-derives when fieldPath changes (no remount needed)
  const { fields, path } = $derived(getFieldBuildersAtPath(fieldPath, docConfig.fields));
</script>

<form class="rz-live-edit-panel" use:form.enhance enctype="multipart/form-data" method="post">
  <ScrollArea class="rz-live-edit-panel__fields">
    {#key doc.id + (doc.versionId || '') + (doc.locale || '')}
      <RenderFields {fields} {path} {form} />
    {/key}
  </ScrollArea>
</form>
