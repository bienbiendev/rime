<script lang="ts">
  import type { BuiltCollection } from '$lib/core/config/types.js';
  import type { GenericDoc } from '$lib/core/types/doc.js';
  import Checkbox from '$lib/panel/components/ui/checkbox/checkbox.svelte';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte';
  import { getValueAtPath } from '$lib/util/object';
  import StatusDot from '../../StatusDot.svelte';
  import UploadThumbCell from '../../upload-thumb-cell/UploadThumbCell.svelte';

  type Props = {
    checked: boolean;
    doc: GenericDoc;
    isSelectMode?: boolean;
    config: BuiltCollection;
    toggleSelectOf?: (id: string) => void;
    columns?: Array<{ path: string; cell?: any }>;
    draggable?: 'true';
  };

  const { checked, doc, config, isSelectMode, toggleSelectOf, columns, draggable }: Props =
    $props();

  const locale = getLocaleContext();

  let gridTemplateColumn = $state('grid-template-columns: 2fr repeat(1, minmax(0, 1fr));');

  $effect(() => {
    const columnLength = (columns?.length ?? 0) + 2;
    gridTemplateColumn = `grid-template-columns: 2fr repeat(${columnLength - 1}, minmax(0, 1fr));`;
  });

  const formattedDate = $derived(
    doc.updatedAt ? locale.dateFormat(doc.updatedAt, { short: true }) : ''
  );

  function handleDragStart(e: DragEvent) {
    e.dataTransfer?.setData('text/plain', doc.id);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  style={gridTemplateColumn}
  class="rz-list-row"
  draggable={draggable || null}
  ondragstart={draggable ? handleDragStart : null}
>
  <div class="rz-list-row__main">
    {#if isSelectMode}
      <!-- On select mode show the checkbox  -->
      <Checkbox
        id="checkbox-{doc.id}"
        class="rz-list-row__checkbox"
        {checked}
        onCheckedChange={() => toggleSelectOf?.(doc.id)}
      />
      {#if doc._thumbnail}
        <UploadThumbCell url={doc._thumbnail} mimeType={doc.mimeType} />
      {/if}
      <label for="checkbox-{doc.id}" class="rz-list-row__title">{doc.title || '[untitled]'}</label>
    {:else}
      <a class="rz-list-row__link" href="/panel/{config.kebab}/{doc.id}">
        {#if doc._thumbnail}
          <UploadThumbCell url={doc._thumbnail} mimeType={doc.mimeType} />
        {:else}
          {@const Icon = config.icon}
          <div class="rz-list-row__icon"><Icon size="13" /></div>
        {/if}

        <span class="rz-list-row__title">{doc.title || '[untitled]'}</span>
        {#if config.versions && config.versions.draft}
          <StatusDot --rz-dot-size="0.28rem" status={doc.status} />
        {/if}
      </a>
    {/if}
  </div>

  {#each columns as column, index (index)}
    <div class="rz-list-row__cell">
      {#if column.cell}
        {@const ColumnTableCell = column.cell}
        <ColumnTableCell value={getValueAtPath(column.path, doc)} />
      {:else}
        {getValueAtPath(column.path, doc)}
      {/if}
    </div>
  {/each}

  <div class="rz-list-row__cell">
    {formattedDate}
  </div>
</div>

<style type="postcss">
  @import '../../../../../style/mixins/index.css';

  .rz-list-row {
    --rz-upload-preview-cell-fit: cover;

    display: grid;
    height: var(--rz-row-height);
    align-items: center;
    border: var(--rz-border);
    border-radius: var(--rz-radius-md);
    background-color: hsl(var(--rz-row-bg));

    .rz-list-row__icon {
      height: var(--rz-size-9);
      width: var(--rz-size-9);
      border-radius: var(--rz-radius-sm);
      display: flex;
      flex-shrink: 0;
      flex-grow: 0;
      align-items: center;
      justify-content: center;
      background-color: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-1)));
    }

    :global {
      .rz-list-row__checkbox {
        margin-left: var(--rz-size-2);
        background-color: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-0)));
        border: var(--rz-border);
      }
    }
  }

  .rz-list-row__main {
    display: flex;
    align-items: center;
    gap: var(--rz-size-3);
    padding-left: var(--rz-size-1);
    padding-right: var(--rz-size-5);
  }

  .rz-list-row__link {
    display: flex;
    align-items: center;
    gap: var(--rz-size-4);
  }

  .rz-list-row__title {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-all;
  }
  label.rz-list-row__title {
    cursor: pointer;
  }

  .rz-list-row__cell {
    @mixin color foreground, 0.6;
  }
</style>
