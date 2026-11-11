<script lang="ts">
  import { resolve } from '$app/paths';
  import { t__ } from '#lib/core/i18n/index.js';
  import type { GenericDoc } from '#lib/core/prototype/types.js';
  import Document from '#lib/panel/components/sections/document/Document.svelte';
  import { byKeywords } from '#lib/panel/components/ui/command/filter.js';
  import * as Command from '#lib/panel/components/ui/command/index.js';
  import * as Sheet from '#lib/panel/components/ui/sheet/index.js';
  import { dataError } from '#lib/panel/util/dataError.js';
  import { dataFocused } from '#lib/panel/util/dataFocused.js';
  import { useSortable } from '#lib/panel/util/Sortable.js';
  import X from '@lucide/svelte/icons/x';
  import type { RelationComponentProps } from '../types.js';

  /**
   * A well of the picked documents, as chips, then a search to pick more.
   *
   * The field's label row holds its buttons and calls in: `choose()` opens the search,
   * `create()` opens a new document of the related collection in a sheet.
   */
  type Props = RelationComponentProps & {
    /** A new document of the related collection may be created from here. */
    canCreate?: boolean;
    /** The query names a document the field does not hold. */
    hasCandidate: boolean;
    /** The documents the search found, the first 20; `null` until the first read answers. */
    candidates: GenericDoc[] | null;
    /** How many documents the search matches in all. */
    count: number | null;
    /** The text typed in the search. */
    search?: string;
    /** The search has the focus: its list is open. */
    searching?: boolean;
  };

  let {
    isFull,
    hasError,
    addValue,
    many,
    selectedItems,
    removeValue,
    readOnly,
    nothingToSelect,
    relationConfig,
    onOrderChange,
    formNestedLevel,
    onRelationCreated,
    onRelationCreation,
    onRelationCreationCanceled,
    canCreate = false,
    hasCandidate,
    candidates,
    count,
    search = $bindable(''),
    searching = $bindable(false)
  }: Props = $props();

  let relationList = $state<HTMLElement>();
  let creating = $state(false);
  let commandInput = $state<HTMLInputElement | null>(null);

  /** Focuses the search, which opens the list of documents to pick. */
  export function choose() {
    commandInput?.focus();
  }

  /** Opens a new document of the related collection; this form stays disabled meanwhile. */
  export function create() {
    onRelationCreation();
    creating = true;
  }

  const onNestedDocumentCreated = (doc: GenericDoc) => {
    creating = false;
    // Lists the new document among the candidates, picks it and writes the value
    onRelationCreated(doc);
  };

  const { sortable } = useSortable({
    animation: 150,
    draggable: '.rz-relation__item',
    onEnd: function (evt) {
      if (evt.oldIndex !== undefined && evt.newIndex !== undefined) {
        onOrderChange(evt.oldIndex, evt.newIndex);
      }
    }
  });

  /** The chips reorder by drag; the instance goes with the list. */
  $effect(() => {
    if (!many || !relationList || readOnly) return;
    const instance = sortable(relationList);
    return () => instance.destroy();
  });

  const onSelect = (doc: GenericDoc) => {
    addValue(doc);
    search = '';
  };

  const canSearch = $derived(!readOnly && !isFull && hasCandidate);

  // A search that goes takes its focus with it: a browser may not blur an input it removes.
  $effect(() => {
    if (!canSearch) {
      searching = false;
    }
  });

  /** The documents found, less those picked since the read. */
  const available = $derived(
    (candidates ?? []).filter((doc) => !selectedItems.some((item) => item.documentId === doc.id))
  );
</script>

<div class="rz-relation">
  <Command.Root filter={byKeywords}>
    <div
      class="rz-relation__list"
      use:dataError={hasError}
      use:dataFocused={searching}
      bind:this={relationList}
      class:rz-relation__list--readonly={readOnly}
      data-many={many ? '' : null}
    >
      {#each selectedItems as item (item.documentId)}
        <div class="rz-relation__item">
          <a class="rz-relation__item-title" href={resolve(item.editUrl)}>{item.title}</a>
          {#if !readOnly}
            <button
              type="button"
              class="rz-relation__remove"
              aria-label={t__('fields.remove_item', item.title)}
              onclick={() => removeValue(item.documentId)}
            >
              <X size={12} />
            </button>
          {/if}
        </div>
      {/each}

      {#if nothingToSelect && !selectedItems.length}
        <span class="rz-relation__empty">
          {t__('fields.nothing_to_select', relationConfig.label.plural.toLowerCase())}
        </span>
      {/if}

      {#if canSearch}
        <Command.InputSelect
          onfocus={() => (searching = true)}
          onblur={() => (searching = false)}
          bind:ref={commandInput}
          class="rz-relation__search"
          bind:value={search}
          placeholder={relationConfig.label.search ||
            t__(`common.search_a`, relationConfig.label.singular)}
        />

        {#if searching && candidates}
          <!-- A press keeps the focus in the search, so the list stays until the click picks its
               line; then the search lets go of the focus and the list closes. Enter picks through
               a click of no press (`detail` 0): the search keeps the focus for the next pick. -->
          <Command.List
            onmousedown={(event: MouseEvent) => event.preventDefault()}
            onclick={(event: MouseEvent) => event.detail && commandInput?.blur()}
          >
            {#each available as doc (doc.id)}
              <Command.Item value={doc.id} keywords={[doc.title]} onSelect={() => onSelect(doc)}>
                <span>{doc.title}</span>
              </Command.Item>
            {/each}
            <Command.Empty>{t__('common.nothing_found')}</Command.Empty>
            <Command.Count shown={candidates.length} {count} />
          </Command.List>
        {/if}
      {/if}
    </div>
  </Command.Root>

  {#if canCreate}
    <Sheet.Root
      bind:open={creating}
      onOpenChange={(open) => {
        if (!open) onRelationCreationCanceled();
      }}
    >
      <Sheet.Content style="--rz-page-gutter:var(--rz-size-6)" side="right" showCloseButton={false}>
        <Document
          doc={relationConfig.initial()}
          readOnly={false}
          onClose={() => {
            creating = false;
            onRelationCreationCanceled();
          }}
          operation="create"
          {onNestedDocumentCreated}
          nestedLevel={formNestedLevel + 1}
        />
      </Sheet.Content>
    </Sheet.Root>
  {/if}
</div>

<style type="postcss">
  @import '../../../../panel/style/mixins/index.css';

  .rz-relation {
    position: relative;

    :global {
      .rz-command {
        width: 100%;
        border-radius: var(--rz-radius-lg);
      }

      .rz-command-list {
        @mixin surface float;
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + var(--rz-size-1-5));
        z-index: 20;
        border-radius: var(--rz-radius-xl);
      }

      .rz-command-item {
        min-height: var(--rz-size-7);
        border-radius: var(--rz-radius-md);
        font-size: var(--rz-text-md);
      }

      .rz-command-item[aria-selected='true'] {
        background-color: var(--rz-bg-hover);
      }

      /* Nothing matches: one quiet line. */
      .rz-command-empty {
        padding: var(--rz-size-2) var(--rz-size-2-5);
        color: var(--rz-fg-subtle);
        font-size: var(--rz-text-sm);
      }
    }
  }

  /* One well: the chips, then the search. */
  .rz-relation__list {
    @mixin well;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--rz-size-1);
    min-height: var(--rz-input-height);
    padding: var(--rz-size-1);
    border-radius: var(--rz-radius-lg);
    transition:
      border-color 0.15s,
      box-shadow 0.15s;

    :global(.rz-relation__search) {
      min-width: var(--rz-size-32);
      padding-inline: var(--rz-size-2);
    }
  }

  .rz-relation__list:global([data-focused]) {
    @mixin focus-field;
  }

  .rz-relation__list:global([data-error]) {
    @mixin invalid-field;
  }

  .rz-relation__list--readonly {
    cursor: no-drop;
  }

  /* A picked document: its title, a link to it, and a way out. */
  .rz-relation__item {
    @mixin surface raised;
    display: inline-flex;
    align-items: center;
    gap: var(--rz-size-0-5);
    max-width: 100%;
    height: var(--rz-size-6);
    padding-inline: var(--rz-size-2) var(--rz-size-0-5);
    border-radius: var(--rz-radius-md);
    font-size: var(--rz-text-sm);
  }

  .rz-relation__list[data-many] .rz-relation__item {
    cursor: grab;
  }

  .rz-relation__list--readonly .rz-relation__item {
    padding-inline-end: var(--rz-size-2);
  }

  .rz-relation__item-title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    border-radius: var(--rz-radius-sm);

    &:hover {
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-relation__remove {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: var(--rz-size-5);
    height: var(--rz-size-5);
    border-radius: var(--rz-radius-sm);
    color: var(--rz-fg-subtle);
    transition:
      color 0.15s,
      background-color 0.15s;

    &:hover {
      background-color: var(--rz-bg-hover);
      color: var(--rz-fg);
    }
    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-relation__empty {
    padding-inline: var(--rz-size-2);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
  }
</style>
