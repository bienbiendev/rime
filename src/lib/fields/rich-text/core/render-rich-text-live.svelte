<script lang="ts">
  import { page } from '$app/state';
  import { getLiveContext } from '$lib/panel/context/live.svelte.js';
  import { normalizeFieldPath } from '$lib/util/doc.js';
  import type { JSONContent } from '@tiptap/core';
  import { defaultFeatures } from './features/index.js';
  import RenderRichText from './render-rich-text.svelte';
  import RichTextEditorCore from './rich-text-editor-core.svelte';
  import type { RichTextFeature, RichTextNodeRenderer } from './types.js';

  type Props = {
    /** Initial value, scoped to this field (same convention as `LiveEdit`'s `data` prop) */
    data?: JSONContent;
    /** Full path to the field from the root of the document, e.g. `attributes.text` */
    path: string;
    /** Update URI of the API, e.g. `/pages/123` — defaults to the current document's */
    update?: string;
    features?: RichTextFeature[];
    components?: {
      heading?: RichTextNodeRenderer;
      paragraph?: RichTextNodeRenderer;
      blockquote?: RichTextNodeRenderer;
      bold?: RichTextNodeRenderer;
      italic?: RichTextNodeRenderer;
      link?: RichTextNodeRenderer;
      ul?: RichTextNodeRenderer;
      media?: RichTextNodeRenderer;
      resource?: RichTextNodeRenderer;
      li?: RichTextNodeRenderer;
      ol?: RichTextNodeRenderer;
    } & Record<string, RichTextNodeRenderer>;
  };

  const { data: incomingData, path, update: incomingUpdate, features, components }: Props = $props();

  const live = getLiveContext();
  const update = $derived(incomingUpdate ? incomingUpdate : live.documentUpdateURI);
  const lookupPath = $derived(normalizeFieldPath(path));

  const liveValue = $derived(live?.getPanelValue(update, lookupPath));
  const value = $derived(liveValue ?? incomingData ?? page.data.doc);

  let debounceTimer: ReturnType<typeof setTimeout>;

  function onUpdate(json: JSONContent) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      window.top?.postMessage({ contentUpdate: { update, path, value: json } });
    }, 300);
  }

  function onNonFlowNodeClick() {
    // Non-flow nodes (fields/resource/upload) aren't editable in place — route to the
    // classic sidebar for this field, same activation `LiveEdit` uses for every other field.
    window.top?.postMessage({
      activatePanel: { key: `${path}-${update}`, path, update, fieldPath: path }
    });
  }
</script>

{#if !live?.enabled}
  <RenderRichText json={value} {components} />
{:else}
  <div class="rz-rich-text-live">
    <RichTextEditorCore
      {path}
      features={features || defaultFeatures}
      value={value as JSONContent}
      stripNonFlowNodeViews
      syncExternalValue
      enableSuggestion={false}
      disablePortals
      {onUpdate}
      {onNonFlowNodeClick}
    />
  </div>
{/if}
