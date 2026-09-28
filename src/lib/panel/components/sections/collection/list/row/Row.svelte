<script lang="ts">
  import type { BuiltCollection } from '$lib/core/config/types.js';
  import type { GenericDoc } from '$lib/core/prototype/types.js';
  import { panelPath } from '$lib/core/routes/util.js';
  import Checkbox from '$lib/panel/components/ui/checkbox/checkbox.svelte';
  import { getValueAtPath } from '$lib/util/object';
  import Avatar from '../../Avatar.svelte';
  import DocStatus from '../../DocStatus.svelte';
  import UploadThumbCell from '../../upload-thumb-cell/UploadThumbCell.svelte';
  import When from '../../When.svelte';

  type Props = {
    checked: boolean;
    doc: GenericDoc;
    /** On while a row is checked: the title then picks its row. */
    isSelectMode?: boolean;
    config: BuiltCollection;
    /** Given, the row has a checkbox: shown on hover, and always once a row is checked. */
    toggleSelectOf?: (id: string) => void;
    columns?: Array<{ path: string; cell?: any }>;
    /** The document's path, after its title: `/studio`. */
    path?: string;
    draggable?: 'true';
  };

  const { checked, doc, config, isSelectMode, toggleSelectOf, columns, path, draggable }: Props =
    $props();

  const title = $derived(doc.title || '[untitled]');
  const hasDraft = $derived(!!(config.versions && config.versions.draft));
  const author = $derived<string>(doc.updatedBy?.name ?? '');
  // "Anthony Ivol" -> "Anthony"
  const firstName = $derived(author.split(/\s+/)[0]);

  function handleDragStart(e: DragEvent) {
    e.dataTransfer?.setData('text/plain', doc.id);
  }
</script>

<!-- The tracks come from the list: `--rz-list-tracks`. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="rz-list-row"
  class:rz-list-row--checked={checked}
  class:rz-list-row--select-mode={isSelectMode}
  draggable={draggable || null}
  ondragstart={draggable ? handleDragStart : null}
>
  {#if toggleSelectOf}
    <Checkbox
      id="checkbox-{doc.id}"
      class="rz-list-row__checkbox"
      aria-label={title}
      {checked}
      onCheckedChange={() => toggleSelectOf(doc.id)}
    />
  {:else}
    <span></span>
  {/if}

  <div class="rz-list-row__main">
    {#if config.upload || doc._thumbnail}
      <UploadThumbCell url={doc._thumbnail} mimeType={doc.mimeType} />
    {/if}

    <!-- The title covers the whole row: a click opens the document, or picks it while selecting. -->
    {#if isSelectMode}
      <label for="checkbox-{doc.id}" class="rz-list-row__title">{title}</label>
    {:else}
      <a class="rz-list-row__link rz-list-row__title" href={panelPath(config.kebab, doc.id)}>
        {title}
      </a>
    {/if}

    {#if path}
      <span class="rz-list-row__path">{path}</span>
    {/if}
  </div>

  {#each columns as column (column.path)}
    <div class="rz-list-row__cell" data-column="field">
      {#if column.cell}
        {@const ColumnTableCell = column.cell}
        <ColumnTableCell value={getValueAtPath(column.path, doc)} />
      {:else}
        {getValueAtPath(column.path, doc)}
      {/if}
    </div>
  {/each}

  {#if hasDraft}
    <div class="rz-list-row__cell" data-column="status">
      {#if doc.status}
        <DocStatus status={doc.status} />
      {/if}
    </div>
  {/if}

  <div class="rz-list-row__cell rz-list-row__author" data-column="author" title={author}>
    {#if author}
      <Avatar size="xs" name={author} />
      <span class="rz-list-row__author-name">{firstName}</span>
    {/if}
  </div>

  <div class="rz-list-row__cell rz-list-row__cell--date">
    {#if doc.updatedAt}
      <When date={doc.updatedAt} />
    {/if}
  </div>
</div>

<style type="postcss">
  @import '../../../../../style/mixins/index.css';

  /* A flat row with a hairline on top; the card around the list draws the frame. */
  .rz-list-row {
    --rz-upload-preview-cell-fit: cover;
    --rz-upload-preview-cell-size: var(--rz-size-6);
    --rz-checkbox-size: var(--rz-size-3);

    position: relative;
    display: grid;
    align-items: center;
    gap: var(--rz-size-3);
    height: var(--rz-row-height);
    padding-inline: var(--rz-size-3) var(--rz-size-3-5);
    box-shadow: inset 0 1px 0 var(--rz-border);
    transition: background-color 0.15s;

    &:hover {
      background-color: var(--rz-bg-hover);
    }
  }

  .rz-list-row--checked,
  .rz-list-row--checked:hover {
    background-color: var(--rz-accent-tint);
  }

  /* Above the title's cover, and hidden until the row is hovered, focused or a row is checked. */
  .rz-list-row :global(.rz-list-row__checkbox) {
    position: relative;
    z-index: 1;
    justify-self: center;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .rz-list-row:is(:hover, :focus-within, .rz-list-row--select-mode, .rz-list-row--checked)
    :global(.rz-list-row__checkbox) {
    opacity: 1;
  }

  /* The title, then its path, which gives way first. */
  .rz-list-row__main {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    min-width: 0;

    :global(.rz-upload-preview-cell) {
      margin-right: var(--rz-size-0-5);
    }
  }

  .rz-list-row__title {
    @mixin font-medium;
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
    }
  }

  label.rz-list-row__title {
    cursor: pointer;
  }

  .rz-list-row__link:focus-visible {
    outline: none;

    &::after {
      @mixin focus-ring;
      outline-offset: -2px;
    }
  }

  .rz-list-row__path {
    flex-shrink: 100;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
  }

  .rz-list-row__cell {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--rz-fg-muted);
  }

  .rz-list-row__author {
    display: flex;
    align-items: center;
    gap: var(--rz-size-1-5);
  }

  .rz-list-row__author-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rz-list-row__cell--date {
    text-align: right;
  }
</style>
