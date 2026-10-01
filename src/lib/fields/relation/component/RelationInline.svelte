<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import type { UploadDoc } from '$lib/core/prototype/collection/upload/types.js';
  import { isUploadConfig } from '$lib/core/prototype/collection/upload/util/config.js';
  import { apiUrl } from '$lib/core/routes/util.js';
  import { populate } from '$lib/fields/relation/populate.js';
  import FileDrop from '$lib/panel/components/sections/collection/bulk-upload/FileDrop.svelte';
  import SpinLoader from '$lib/panel/components/ui/spin-loader/SpinLoader.svelte';
  import { getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { uploadFiles, type UploadProgress } from '$lib/panel/util/upload-file.js';
  import { Image as ImageIcon, Trash2 } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import type { Relation, RelationFieldBuilder } from '../index.js';
  import { toRelationValue } from '../value.js';
  import Browse from './upload/Browse.svelte';

  type Props = {
    path: string;
    config: RelationFieldBuilder;
    form: DocumentFormContext;
    /** What the render draws for the related docs: resolved at depth 1, in order. */
    children: Snippet<[{ docs: UploadDoc[]; open: () => void }]>;
    /**
     * Drawn while nothing is related; a drop zone by default. `open` opens the library,
     * `upload` takes files for the field.
     */
    empty?: Snippet<[{ open: () => void; upload: (files: File[]) => void }]>;
    class?: string;
  };
  const { path, config, form, children, empty, class: className }: Props = $props();

  const { getCollection } = getConfigContext();
  const locale = getLocaleContext();
  const relationConfig = $derived(getCollection(config.get.relationTo));
  const isUpload = $derived(isUploadConfig(relationConfig));
  const many = $derived(!!config.get.many);

  const field = $derived(form.useField<Relation[]>(path, config));
  const refs = $derived(Array.isArray(field.value) ? field.value : []);
  const ids = $derived(refs.map((ref) => ref.documentId));
  /** Files and the library only reach an editable field to an upload collection. */
  const canPick = $derived(field.editable && isUpload);

  /** The docs drawn: a pick brings its own, a relation there on load is resolved once. */
  const known = new SvelteMap<string, UploadDoc>();
  $effect(() => {
    for (const ref of refs) {
      if (known.has(ref.documentId)) continue;
      const lookup = { relationTo: ref.relationTo, documentId: ref.documentId };
      populate<unknown>(lookup).then((doc) => {
        if (doc && typeof doc === 'object' && '_type' in doc) {
          known.set(ref.documentId, doc as UploadDoc);
        }
      });
    }
  });
  const docs = $derived(ids.flatMap((id) => known.get(id) ?? []));

  let browsing = $state(false);
  const open = () => (browsing = true);

  $effect(() => {
    if (!isUpload) console.warn(`RelationInline at ${path}: ${config.get.relationTo} is no upload`);
  });

  /** The picker's selection, written the way the relation field writes it. */
  function onChange(next: string[], seen: UploadDoc[]) {
    for (const doc of seen) if (next.includes(doc.id)) known.set(doc.id, doc);
    const items = next.map((documentId) => ({
      documentId,
      id: refs.find((ref) => ref.documentId === documentId)?.id
    }));
    field.value = toRelationValue(items, {
      relationTo: config.get.relationTo,
      path,
      locale: config.get.localized ? locale.code : undefined
    }) as Relation[];
  }

  /* ------------------------------------------------------------ uploading */

  const APIProxy = getAPIProxyContext();
  let progress = $state<UploadProgress | null>(null);
  let failed = $state<string[]>([]);

  /** Each file becomes a media of the library, then the pick: after the others, or in place. */
  async function upload(files: File[]) {
    failed = [];
    const target = { url: apiUrl(relationConfig.kebab), accept: relationConfig.upload?.accept };
    const result = await uploadFiles(files, target, (state) => (progress = state));
    progress = null;
    failed = result.failed;
    if (!result.docs.length) return;
    const added = result.docs.map((doc) => doc.id);
    onChange(many ? [...ids, ...added] : added.slice(0, 1), result.docs);
    APIProxy.invalidate(apiUrl(relationConfig.kebab));
  }

  /** A control does its job and stops there, before the block under it selects itself again. */
  function control(event: MouseEvent, action: () => unknown) {
    event.stopPropagation();
    action();
  }

  /** On the stage, the first click selects the block; a click on the selected one opens. */
  function onDrawnClick(event: MouseEvent) {
    const block = (event.currentTarget as HTMLElement).closest('.rz-renders__item');
    if (!block || block.hasAttribute('data-selected')) open();
  }
</script>

<!-- What a render draws for its related docs, and the place where they are picked. -->
<div class="rz-relation-inline {className ?? ''}" data-many={many ? '' : undefined}>
  {#if docs.length}
    <div class="rz-relation-inline__drawn" role="presentation" onclick={onDrawnClick}>
      {@render children({ docs, open })}
    </div>
    {#if !field.editable}
      <!-- Read-only: drawn, never picked. -->
    {:else}
      <!-- One bar, bottom right: replace or edit the selection, then remove. -->
      <div class="rz-relation-inline__controls">
        <button type="button" onclick={(event) => control(event, open)}>
          {many ? t__('fields.edit_selection') : t__('fields.replace')}
        </button>
        {#if !many}
          <span class="rz-relation-inline__separator" aria-hidden="true"></span>
          <button
            type="button"
            class="rz-relation-inline__icon"
            title={t__('fields.remove')}
            aria-label={t__('fields.remove')}
            onclick={(event) => control(event, () => onChange([], []))}
          >
            <Trash2 size={14} />
          </button>
        {/if}
      </div>
    {/if}
  {:else if ids.length}
    <div class="rz-relation-inline__loading" aria-busy="true"></div>
  {:else if empty}
    {@render empty({ open, upload })}
  {:else}
    <FileDrop
      class="rz-relation-inline__empty"
      multiple={many}
      accept={relationConfig.upload?.accept}
      disabled={!canPick || !!progress}
      onfiles={upload}
    >
      {#snippet children({ browse })}
        {#if progress}
          <SpinLoader />
          <span aria-live="polite">
            {t__(
              'fields.uploading',
              String(Math.min(progress.uploaded + progress.failed.length + 1, progress.total)),
              String(progress.total)
            )}
          </span>
        {:else}
          <ImageIcon size={18} />
          <span>
            {many ? t__('common.drop_files') : t__('common.drop_file')}
            {t__('common.or')}
            <button type="button" class="rz-file-drop__link" disabled={!canPick} onclick={browse}>
              {t__('common.browse')}
            </button>
          </span>
          <small>
            {t__('common.or')}
            <button type="button" class="rz-file-drop__link" disabled={!canPick} onclick={open}>
              {t__('fields.choose_in_library')}
            </button>
          </small>
          {#if failed.length}
            <small>{t__('fields.upload_failed', failed.join(', '))}</small>
          {/if}
        {/if}
      {/snippet}
    </FileDrop>
  {/if}
</div>

{#if isUpload}
  <Browse
    bind:open={browsing}
    config={relationConfig}
    {many}
    selected={ids}
    {onChange}
    nestedLevel={form.nestedLevel + 1}
    onCreating={(creating) => (form.isDisabled = creating)}
  />
{/if}

<style lang="postcss">
  @import '../../../panel/style/mixins/index.css';

  .rz-relation-inline {
    position: relative;
  }

  /*
   * Over the drawn docs, bottom right, clear of the block's own bar on top: on a selected block,
   * or under the pointer.
   */
  .rz-relation-inline__controls {
    @mixin surface float;
    position: absolute;
    right: var(--rz-size-2);
    bottom: var(--rz-size-2);
    z-index: 2;
    display: none;
    align-items: center;
    gap: var(--rz-size-0-5);
    padding: var(--rz-size-0-5);
    border-radius: var(--rz-radius-lg);

    button {
      height: var(--rz-size-7);
      padding-inline: var(--rz-size-2-5);
      border-radius: var(--rz-radius-md);
      color: var(--rz-fg-muted);
      font-size: var(--rz-text-xs);
      &:hover {
        @mixin hover;
        color: var(--rz-fg);
      }
      &:focus-visible {
        @mixin focus-ring;
      }
    }
  }

  .rz-relation-inline__icon {
    display: grid;
    place-items: center;
    width: var(--rz-size-7);
    padding: 0;
  }

  .rz-relation-inline__separator {
    width: 1px;
    height: var(--rz-size-4);
    background-color: var(--rz-border);
  }

  .rz-relation-inline:hover .rz-relation-inline__controls,
  :global(.rz-renders__item[data-selected]) .rz-relation-inline__controls {
    display: flex;
  }

  /* On the stage, the zone stands on the page like the render it waits for. */
  .rz-relation-inline :global(.rz-relation-inline__empty) {
    width: 100%;
    padding: var(--rz-size-11) var(--rz-size-4);
  }

  .rz-relation-inline__loading {
    width: 100%;
    min-height: var(--rz-size-32);
    border: 1px dashed var(--rz-border-strong);
    border-radius: var(--rz-radius-md);
    background-color: var(--rz-bg-well);
  }
</style>
