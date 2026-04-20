<script lang="ts">
  import { goto } from '$app/navigation';
  import type { User } from '$lib/core/collections/auth/types.js';
  import type { BuiltConfigClient } from '$lib/core/config/types.js';
  import { Toaster } from '$lib/panel/components/ui/sonner';
  import { setAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import { setConfigContext } from '$lib/panel/context/config.svelte.js';
  import createContext from '$lib/panel/context/createContext.svelte.js';
  import { setLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { setUserContext } from '$lib/panel/context/user.svelte.js';
  import { toKebabCase } from '$lib/util/string';
  import ScrollArea from '../../ui/scroll-area/scroll-area.svelte';
  import Document from '../document/Document.svelte';
  import './side-panel.css';

  type Props = {
    doc: any;
    locale: string | undefined;
    config: BuiltConfigClient;
    onDataChange: any;
    onFieldFocus: any;
    user: User;
  };

  const { doc, config, locale: initialeLocale, user, onDataChange, onFieldFocus }: Props = $props();

  function buildPanelURL() {
    // Start with the base URI for the panel
    let panelUri = `/panel/${toKebabCase(doc._type)}`;

    // Add the item ID to the URI if we're updating a collection doc
    if (doc._prototype === 'collection' && doc.id) {
      panelUri += `/${doc.id}`;
    }
    return panelUri;
  }

  setAPIProxyContext();
  // svelte-ignore state_referenced_locally
  setConfigContext(config);
  // svelte-ignore state_referenced_locally
  setUserContext(user);
  createContext('title', '[untitled]');

  $effect(() => {
    setLocaleContext(initialeLocale);
  });
</script>

<Toaster />

<ScrollArea class="rz-live-panel">
  {#key doc.id + doc.versionId || '' + doc.locale || ''}
    <Document
      onClose={() => goto(buildPanelURL())}
      {onDataChange}
      {onFieldFocus}
      {doc}
      readOnly={false}
      operation="update"
    />
  {/key}
</ScrollArea>
