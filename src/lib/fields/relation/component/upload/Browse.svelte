<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { directoriesKebab } from '$lib/core/prototype/collection/upload/naming.js';
  import type { Directory } from '$lib/core/prototype/collection/upload/types';
  import { apiUrl } from '$lib/core/routes/util.js';
  import Empty from '$lib/panel/components/sections/collection/Empty.svelte';
  import FileDrop from '$lib/panel/components/sections/collection/bulk-upload/FileDrop.svelte';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import * as DropdownMenu from '$lib/panel/components/ui/dropdown-menu/index.js';
  import Input from '$lib/panel/components/ui/input/input.svelte';
  import { getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import { getUserContext } from '$lib/panel/context/user.svelte.js';
  import { typeLabel, uploadFiles, type UploadProgress } from '$lib/panel/util/upload-file.js';
  import type { BuiltCollection, GenericDoc, UploadDoc } from '$lib/types';
  import {
    Check,
    CornerLeftUp,
    Folder,
    ImagePlus,
    ListFilter,
    Plus,
    Search,
    Upload,
    X
  } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import Create from './Create.svelte';

  type Props = {
    open: boolean;
    config: BuiltCollection;
    many: boolean;
    /** Document ids, in the order they were picked. */
    selected: string[];
    /** The whole selection once confirmed; `seen` are the docs the grid has shown. */
    onChange: (ids: string[], seen: UploadDoc[]) => void;
    /** The level of a document created from the picker. */
    nestedLevel: number;
    /** A document is being created, or no longer: the one underneath holds its saves meanwhile. */
    onCreating?: (creating: boolean) => void;
  };

  let {
    open = $bindable(),
    config,
    many,
    selected,
    onChange,
    nestedLevel,
    onCreating
  }: Props = $props();

  let path = $state('root');
  let searchValue = $state('');
  let typeFilterValue = $state('');
  let initialDocs = $state<UploadDoc[]>([]);
  let searchInput = $state<HTMLInputElement | null>(null);

  const isFiltered = $derived.by(() => {
    return searchValue.trim() !== '' || typeFilterValue !== '';
  });

  const encodedMime = $derived.by(() => {
    if (typeFilterValue) {
      return encodeURIComponent(typeFilterValue);
    }
    return '';
  });

  const parentPath = $derived.by(() => {
    if (path.includes(':')) {
      const segments = path.split(':');
      return segments.slice(0, -1).join(':');
    } else {
      return null;
    }
  });

  const filesURL = $derived.by(() => {
    if (!isFiltered) {
      return `${apiUrl(config.kebab)}?where[_path][equals]=${path}`;
    } else {
      if (typeFilterValue && searchValue.trim()) {
        return `${apiUrl(config.kebab)}?where[and][0][mimeType][equals]=${encodedMime}&where[and][1][filename][like]=%${searchValue.trim()}%`;
      } else if (typeFilterValue) {
        return `${apiUrl(config.kebab)}?where[mimeType][equals]=${encodedMime}`;
      } else if (searchValue.trim()) {
        return `${apiUrl(config.kebab)}?where[filename][like]=%${searchValue.trim()}%`;
      } else {
        return `${apiUrl(config.kebab)}?where[_path][equals]=${path}`;
      }
    }
  });

  const foldersURL = $derived.by(() => {
    return `${apiUrl(directoriesKebab(config.slug))}?where[parent][equals]=${path}`;
  });

  const APIProxy = getAPIProxyContext();
  let files = $derived(APIProxy.getRessource<{ docs: UploadDoc[] }>(filesURL));
  let folders = $derived(APIProxy.getRessource<{ docs: Directory[] }>(foldersURL));

  $effect(() => {
    if (!initialDocs.length && files.data?.docs.length) {
      initialDocs = files.data.docs;
    }
  });

  /** Nothing uploaded yet: no file and no folder at the root. */
  const isEmpty = $derived(
    !isFiltered && !parentPath && files.data?.docs.length === 0 && !folders.data?.docs.length
  );

  /* ------------------------------------------------------------ picking */

  /** Every doc the grid has shown, so a pick made in another folder can still be written. */
  const seen = new SvelteMap<string, UploadDoc>();
  $effect(() => {
    for (const doc of files.data?.docs ?? []) seen.set(doc.id, doc);
  });

  /** The picks while the dialog is open: "Add" writes them, closing drops them. */
  let draft = $state<string[]>([]);
  $effect.pre(() => {
    if (open) draft = untrack(() => [...selected]);
  });

  const commit = (ids: string[]) => onChange(ids, [...seen.values()]);

  function confirm() {
    commit(draft);
    open = false;
  }

  /** One: the doc, in place of the one before, and the dialog closes. Many: in or out. */
  function toggle(id: string, add = !draft.includes(id)) {
    if (!many) {
      commit([id]);
      open = false;
      return;
    }
    const has = draft.includes(id);
    if (add && !has) draft = [...draft, id];
    if (!add && has) draft = draft.filter((candidate) => candidate !== id);
    last = id;
  }

  /** The last doc picked or unpicked, where a shift-click range starts. */
  let last: string | null = null;

  function range(id: string) {
    const order = (files.data?.docs ?? []).map((doc) => doc.id);
    const from = last ? order.indexOf(last) : -1;
    const to = order.indexOf(id);
    if (from === -1 || to === -1) return toggle(id);
    const span = order.slice(Math.min(from, to), Math.max(from, to) + 1);
    draft = [...draft, ...span.filter((candidate) => !draft.includes(candidate))];
    last = id;
  }

  /**
   * A press on a doc picks it or unpicks it, and while the pointer stays down every doc it crosses
   * takes the same state. The pointer is read with `elementFromPoint`: a touch captures it, and
   * the other cards never see it enter.
   */
  let sweep: { add: boolean; crossed: Set<string> } | null = null;

  function onPointerDown(event: PointerEvent, id: string) {
    if (!many || event.button !== 0 || event.shiftKey) return;
    sweep = { add: !draft.includes(id), crossed: new Set([id]) };
    toggle(id, sweep.add);
  }

  function onPointerMove(event: PointerEvent) {
    if (!sweep) return;
    const card = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-id]');
    const id = card instanceof HTMLElement ? card.dataset.id : undefined;
    if (!id || sweep.crossed.has(id)) return;
    sweep.crossed.add(id);
    toggle(id, sweep.add);
  }

  const endSweep = () => (sweep = null);

  /** A pointer click was the press; the keyboard's click and a shift-click are their own. */
  function onClick(event: MouseEvent, id: string) {
    if (!many) return toggle(id);
    if (event.shiftKey) return range(id);
    if (event.detail === 0) return toggle(id);
  }

  /* ----------------------------------------------------------- creating */

  const user = getUserContext();
  const canCreate = $derived(!!config.access.create?.(user.attributes, {}));
  const label = $derived(config.label.singular || config.slug);
  let creating = $state(false);

  function startCreate() {
    creating = true;
    onCreating?.(true);
  }

  /** A new document shows in the grid and is picked, as a click would pick it. */
  function onCreated(doc: GenericDoc) {
    onCreating?.(false);
    seen.set(doc.id, doc as UploadDoc);
    APIProxy.invalidate(apiUrl(config.kebab));
    toggle(doc.id, true);
  }

  /* ---------------------------------------------------------- uploading */

  const accept = $derived(config.upload?.accept);
  let uploadInput = $state<HTMLInputElement>();
  let progress = $state<UploadProgress | null>(null);
  let failed = $state<string[]>([]);

  /** Files land in the folder on screen, then show there, picked. */
  async function upload(list: File[]) {
    failed = [];
    const target = { url: apiUrl(config.kebab), path, accept };
    const result = await uploadFiles(list, target, (state) => (progress = state));
    progress = null;
    failed = result.failed;
    if (!result.docs.length) return;
    for (const doc of result.docs) seen.set(doc.id, doc);
    searchValue = '';
    typeFilterValue = '';
    APIProxy.invalidate(apiUrl(config.kebab));
    if (!many) return toggle(result.docs[0].id);
    const ids = result.docs.map((doc) => doc.id);
    draft = [...draft, ...ids.filter((id) => !draft.includes(id))];
  }

  /* ------------------------------------------------------------- labels */

  const fileTypes = $derived.by(() => {
    if (initialDocs.length) {
      const types = new Set(initialDocs.map((doc) => doc.mimeType));
      return Array.from(types);
    }
    return [];
  });

  const searchPlaceholder = $derived(
    t__('common.search', `${initialDocs.length || 0} document(s)`)
  );

  /** "Add 2 images", or files when the collection takes more than images. */
  const addLabel = $derived.by(() => {
    const images = !!accept?.length && accept.every((type) => type.startsWith('image/'));
    const key = images ? 'fields.add_images' : 'fields.add_files';
    return t__(draft.length === 1 ? key : `${key}|m|p`, String(draft.length));
  });

  const isImage = (doc: UploadDoc) => !!doc._thumbnail && !!doc.mimeType?.includes('image');
  const meta = (doc: UploadDoc) =>
    [doc.filesize, typeLabel(doc.mimeType)].filter(Boolean).join(' · ');
</script>

<svelte:window onpointermove={onPointerMove} onpointerup={endSweep} onpointercancel={endSweep} />

<Dialog.Root bind:open>
  <Dialog.Content
    class="rz-relation-browse-dialog"
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      searchInput?.focus();
    }}
  >
    <div class="rz-relation-browse">
      <header class="rz-relation-browse__head">
        <Dialog.Title level={3}>
          {many ? t__('fields.choose_medias') : t__('fields.choose_media')}
        </Dialog.Title>
        <Button
          variant="ghost"
          size="icon-sm"
          icon={X}
          aria-label={t__('common.close')}
          onclick={() => (open = false)}
        />
      </header>

      <div class="rz-relation-browse__tools">
        <Input
          bind:ref={searchInput}
          icon={Search}
          class="rz-relation-browse__search"
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          type="text"
          bind:value={searchValue}
        />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger disabled={fileTypes.length <= 1}>
            {#snippet child({ props })}
              <Button variant="ghost" size="sm" icon={ListFilter} {...props}>
                {typeFilterValue || t__('fields.all_types')}
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>

          <DropdownMenu.Content class="rz-link__type-content" align="start">
            <DropdownMenu.Item onclick={() => (typeFilterValue = '')}>
              {t__('fields.all_types')}
            </DropdownMenu.Item>
            {#each fileTypes as type, index (index)}
              <DropdownMenu.Item onclick={() => (typeFilterValue = type)}>
                {type}
              </DropdownMenu.Item>
            {/each}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        {#if canCreate}
          <span class="rz-relation-browse__spacer"></span>
          <Button variant="ghost" size="sm" icon={Plus} onclick={startCreate}>
            {t__('common.create_new', label)}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Upload}
            disabled={!!progress}
            onclick={() => uploadInput?.click()}
          >
            {#if progress}
              {t__(
                'fields.uploading',
                String(Math.min(progress.uploaded + progress.failed.length + 1, progress.total)),
                String(progress.total)
              )}
            {:else}
              {t__('fields.upload')}
            {/if}
          </Button>
          <input
            bind:this={uploadInput}
            type="file"
            hidden
            multiple={many}
            accept={accept?.join(',')}
            onchange={(event) => {
              const list = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              if (list.length) upload(list);
            }}
          />
        {/if}
      </div>

      <div class="rz-relation-browse__body">
        {#if failed.length}
          <p class="rz-relation-browse__notice" role="status">
            {t__('fields.upload_failed', failed.join(', '))}
          </p>
        {/if}

        {#if isEmpty}
          <FileDrop
            class="rz-relation-browse__empty"
            multiple={many}
            {accept}
            disabled={!canCreate || !!progress}
            onfiles={upload}
          >
            {#snippet children({ browse })}
              <ImagePlus size={18} />
              <span>{config.label.none || t__('common.no_document', label)}</span>
              {#if canCreate}
                <small>
                  {many ? t__('common.drop_files') : t__('common.drop_file')}
                  {t__('common.or')}
                  <button type="button" class="rz-file-drop__link" onclick={browse}>
                    {t__('common.browse')}
                  </button>
                </small>
              {/if}
            {/snippet}
          </FileDrop>
        {/if}

        {#if isFiltered && files.data?.docs.length === 0}
          <Empty {config} />
        {/if}

        {#if !isFiltered && (parentPath || folders.data?.docs.length)}
          <div class="rz-relation-browse__folders">
            {#if parentPath}
              <button type="button" class="rz-browse__folder" onclick={() => (path = parentPath)}>
                <CornerLeftUp size={15} />
                <b>..</b>
              </button>
            {/if}
            {#each folders.data?.docs ?? [] as doc (doc.id)}
              <button type="button" class="rz-browse__folder" onclick={() => (path = doc.id)}>
                <Folder size={15} />
                <b>{doc.name}</b>
              </button>
            {/each}
          </div>
        {/if}

        {#if files.data?.docs.length}
          <div class="rz-relation-browse__grid">
            {#each files.data.docs as doc (doc.id)}
              {@const position = draft.indexOf(doc.id)}
              <button
                type="button"
                class="rz-relation-browse__item"
                data-id={doc.id}
                data-selected={position === -1 ? undefined : ''}
                aria-pressed={position !== -1}
                onpointerdown={(event) => onPointerDown(event, doc.id)}
                onclick={(event) => onClick(event, doc.id)}
              >
                <span class="rz-relation-browse__thumb">
                  {#if isImage(doc)}
                    <img src={doc._thumbnail} alt="" loading="lazy" draggable="false" />
                  {:else}
                    <span class="rz-relation-browse__type">{typeLabel(doc.mimeType)}</span>
                  {/if}
                  <span class="rz-relation-browse__mark" aria-hidden="true">
                    {#if position !== -1}
                      {#if many}{position + 1}{:else}<Check size={11} strokeWidth={2.5} />{/if}
                    {/if}
                  </span>
                </span>
                <span class="rz-relation-browse__name">{doc.title}</span>
                <span class="rz-relation-browse__meta">{meta(doc)}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      {#if many}
        <footer class="rz-relation-browse__footer">
          <span class="rz-relation-browse__count">
            {t__('fields.selected_count', String(draft.length))}
            {#if draft.length}
              ·
              <button type="button" class="rz-relation-browse__clear" onclick={() => (draft = [])}>
                {t__('fields.clear')}
              </button>
            {/if}
          </span>
          <span class="rz-relation-browse__actions">
            <Button variant="ghost" size="sm" onclick={() => (open = false)}>
              {t__('common.cancel')}
            </Button>
            <Button size="sm" disabled={!draft.length && !selected.length} onclick={confirm}>
              {addLabel}
            </Button>
          </span>
        </footer>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>

<Create
  bind:open={creating}
  {config}
  {nestedLevel}
  {onCreated}
  onCancel={() => onCreating?.(false)}
/>

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  :global(.rz-dialog-content.rz-relation-browse-dialog) {
    top: 50%;
    display: flex;
    flex-direction: column;
    gap: 0;
    width: min(var(--rz-size-tablet), calc(100vw - 2 * var(--gutter)));
    height: min(var(--rz-size-xl), calc(100dvh - 2 * var(--gutter)));
    padding: 0;
    overflow: hidden;
    border-radius: var(--rz-radius-xl);
  }

  .rz-relation-browse {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .rz-relation-browse__head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-3);
    height: var(--rz-size-12);
    padding: 0 var(--rz-size-2-5) 0 var(--rz-size-4);

    :global(.rz-dialog-title) {
      margin: 0;
      font-size: var(--rz-text-lg);
    }
  }

  .rz-relation-browse__tools {
    flex-shrink: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--rz-size-1-5);
    padding: 0 var(--rz-size-4) var(--rz-size-3);
    box-shadow: inset 0 -1px 0 var(--rz-border);

    :global(.rz-relation-browse__search) {
      flex: 1 1 var(--rz-size-48);
      width: auto;
    }
    :global(.rz-input) {
      height: var(--rz-size-8);
    }
    :global(.rz-dropdown-item) {
      padding: var(--rz-size-3) var(--rz-size-3);
    }
  }

  .rz-relation-browse__spacer {
    flex: 1 0 0;
  }

  .rz-relation-browse__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-4);
    padding: var(--rz-size-4);
  }

  .rz-relation-browse__notice {
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
  }

  .rz-relation-browse__body :global(.rz-relation-browse__empty) {
    flex: 1;
  }

  /* Folders: raised rows, then the files. */
  .rz-relation-browse__folders {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--rz-size-40), 1fr));
    gap: var(--rz-size-2);
  }

  .rz-browse__folder {
    @mixin surface raised;
    display: flex;
    align-items: center;
    gap: var(--rz-size-2-5);
    height: var(--rz-size-10);
    padding: 0 var(--rz-size-3);
    border-radius: var(--rz-radius-lg);
    text-align: left;

    :global(svg) {
      flex-shrink: 0;
      color: var(--rz-fg-subtle);
    }
    b {
      @mixin font-medium;
      @mixin line-clamp 1;
    }
    &:hover {
      @mixin hover;
    }
    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-relation-browse__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--rz-size-28), 1fr));
    gap: var(--rz-size-4) var(--rz-size-3-5);
    align-content: start;
  }

  /* A press and a drag pick, not select text or lift the image. */
  .rz-relation-browse__item {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-1-5);
    min-width: 0;
    text-align: left;
    user-select: none;
    -webkit-user-drag: none;
    border-radius: var(--rz-radius-md);

    &:focus-visible {
      @mixin focus-ring;
      outline-offset: 4px;
    }
  }

  .rz-relation-browse__thumb {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 4 / 3;
    border-radius: var(--rz-radius-md);
    background-color: var(--rz-bg-well);

    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: inherit;
      pointer-events: none;
    }

    /* A hairline over the image, stronger under the pointer. */
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px var(--rz-border);
      pointer-events: none;
      transition: box-shadow 0.15s;
    }
  }

  .rz-relation-browse__item:hover .rz-relation-browse__thumb::after {
    box-shadow: inset 0 0 0 1px var(--rz-border-strong);
  }

  .rz-relation-browse__item[data-selected] .rz-relation-browse__thumb {
    outline: 2px solid var(--rz-accent);
    outline-offset: 2px;
  }

  .rz-relation-browse__type {
    color: var(--rz-fg-subtle);
    font-family: var(--rz-font-mono);
    font-size: var(--rz-text-xs);
    letter-spacing: 0.04em;
    @mixin font-semibold;
  }

  /* A ring under the pointer; filled, with its rank or a check, once picked. */
  .rz-relation-browse__mark {
    position: absolute;
    z-index: 1;
    top: var(--rz-size-1-5);
    left: var(--rz-size-1-5);
    display: grid;
    place-items: center;
    min-width: var(--rz-size-5);
    height: var(--rz-size-5);
    padding-inline: var(--rz-size-1);
    border-radius: var(--rz-radius-full);
    background-color: var(--rz-bg-overlay);
    box-shadow: inset 0 0 0 1.5px var(--rz-accent-contrast);
    color: var(--rz-accent-fg);
    font-size: var(--rz-text-xs);
    font-variant-numeric: tabular-nums;
    @mixin font-semibold;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .rz-relation-browse__item:hover .rz-relation-browse__mark,
  .rz-relation-browse__item[data-selected] .rz-relation-browse__mark {
    opacity: 1;
  }

  .rz-relation-browse__item[data-selected] .rz-relation-browse__mark {
    background-color: var(--rz-accent);
    box-shadow: none;
  }

  .rz-relation-browse__name {
    @mixin font-medium;
    font-size: var(--rz-text-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rz-relation-browse__meta {
    margin-top: calc(-1 * var(--rz-size-1));
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-xs);
  }

  .rz-relation-browse__footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-3);
    height: var(--rz-size-12);
    padding: 0 var(--rz-size-3) 0 var(--rz-size-4);
    box-shadow: inset 0 1px 0 var(--rz-border);
  }

  .rz-relation-browse__count {
    color: var(--rz-fg-muted);
    font-variant-numeric: tabular-nums;
  }

  .rz-relation-browse__clear {
    color: var(--rz-accent-text);
    &:hover {
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    &:focus-visible {
      @mixin focus-ring;
      border-radius: var(--rz-radius-sm);
    }
  }

  .rz-relation-browse__actions {
    display: flex;
    gap: var(--rz-size-1);
  }
</style>
