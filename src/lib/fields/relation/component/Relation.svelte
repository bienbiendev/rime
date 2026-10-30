<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import { isUploadConfig } from '#lib/core/prototype/collection/upload/util/config.js';
  import type { GenericDoc } from '#lib/core/prototype/types.js';
  import { panelPath } from '#lib/core/routes/util.js';
  import { fieldset } from '#lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '#lib/panel/components/fields/index.js';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import { getConfigContext } from '#lib/panel/context/config.svelte.js';
  import { type DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
  import type { FormContext } from '#lib/panel/context/form.svelte.js';
  import { getLocaleContext } from '#lib/panel/context/locale.svelte.js';
  import { getUserContext } from '#lib/panel/context/user.svelte.js';
  import { useCandidates, useCount, usePicks } from '#lib/panel/util/candidates.svelte.js';
  import { moveItem } from '#lib/util/array.js';
  import { snapshot } from '#lib/util/state.js';
  import Images from '@lucide/svelte/icons/images';
  import Plus from '@lucide/svelte/icons/plus';
  import TextSearch from '@lucide/svelte/icons/text-search';
  import { untrack } from 'svelte';
  import type { RelationFieldBuilder, RelationRow } from '../index.js';
  import { queryOf } from '../query.js';
  import { toRelationValue } from '../value.js';
  import Default from './default/Default.svelte';
  import type { RelationFieldItem } from './types.js';
  import Upload from './upload/Upload.svelte';

  // Props
  type Props = {
    path: string;
    config: RelationFieldBuilder;
    form: DocumentFormContext | FormContext;
  };
  const { path, config, form }: Props = $props();

  // Context
  const { getCollection } = getConfigContext();
  const locale = getLocaleContext();
  const field = $derived(form.useField(path, config));
  // svelte-ignore state_referenced_locally
  const relationConfig = getCollection(config.get.relationTo);
  const isRelationToUpload = isUploadConfig(relationConfig);
  const live = $derived('isLive' in form && form.isLive);

  /** The saved picks are read: the field may offer more. */
  let initialized = $state(false);
  // value from the form
  let initialValue = $derived(form.getRawValue<RelationRow[]>(path) || []);
  const ids = $derived(initialValue.map((relation) => relation.documentId));
  // Bumped after a drag reorder: Upload.svelte rebuilds its list of thumbnails from the picks.
  let stamp = $state(new Date().getTime().toString());

  let selectedItems = $state<RelationFieldItem[]>([]);

  /** The field's `query()` for the values on screen. */
  const query = $derived(queryOf(config.get, form.values));

  /** The docs this field picks itself: from its search, its library, an upload or a creation. */
  let known = $state.raw<GenericDoc[]>([]);
  const picks = usePicks(() => ({ config: relationConfig, ids, known }));

  // The picks follow the value: the saved ones at mount, those a render beside the field picks,
  // and fresh docs after a save. A doc in hand is drawn at once, before the read answers.
  $effect(() => {
    const docs = picks.docs;
    untrack(() => {
      selectedItems = docs.map(documentToRelationFieldItem);
    });
  });

  $effect(() => {
    if (picks.ready) initialized = true;
  });

  /** A plain relation searches its collection; an upload one picks in its library. */
  const plain = !isRelationToUpload;
  /** The search below the picks: open while it has the focus, and the text typed in it. */
  let searching = $state(false);
  let search = $state('');

  /** The search's list and its count: read while the search is open, the picks left out. */
  const found = useCandidates(() => ({
    open: plain && searching,
    config: relationConfig,
    query,
    search,
    exclude: ids,
    depth: live ? 1 : undefined
  }));

  /** How many documents the field could still pick. */
  const left = useCount(() => ({
    open: plain && initialized,
    config: relationConfig,
    query,
    exclude: ids
  }));
  const hasCandidate = $derived((left.count ?? 0) > 0);
  /** Shown while the field has no picks: the query names no document. */
  const nothingToSelect = $derived(left.count === 0);

  const isFull = $derived(
    config.get.many ? selectedItems.length > 0 && left.count === 0 : selectedItems.length === 1
  );

  // Convert a document to a relation field item value
  function documentToRelationFieldItem(doc: GenericDoc) {
    const itemInFieldValue = retreiveRelation(doc.id);
    const item: RelationFieldItem = {
      documentId: doc.id,
      title: doc.title,
      editUrl: panelPath(relationConfig.kebab, doc.id),
      _type: doc._type,
      _prototype: doc._prototype
    };
    if (itemInFieldValue) {
      item.id = itemInFieldValue.id;
    }
    if (isUploadConfig(relationConfig)) {
      const isRelationToImage = doc.mimeType?.includes('image');
      item.isImage = isRelationToImage;
      item.filename = doc.filename;
      item.filesize = doc.filesize;
      item.mimeType = doc.mimeType;
      if (isRelationToImage) {
        item.url = doc._thumbnail;
      }
    }
    if (live) {
      item.livePreview = doc;
    }
    return item;
  }

  /** The stored relation row for this document, to keep its id, or none. */
  const retreiveRelation = (documentId: string) =>
    initialValue.find((relation) => relation.documentId === documentId) ?? null;

  // Actions
  /** The field's value for the picks, in order. */
  const buildRelationFieldValue = () => {
    const items = selectedItems.map((item) => ({
      ...item,
      livePreview: live && item.livePreview ? snapshot(item.livePreview) : undefined
    }));
    return toRelationValue(items, {
      relationTo: config.get.relationTo,
      path,
      locale: config.get.localized ? locale.code : undefined,
      live
    });
  };

  // Disable this form while a related document is created, so saving that one does not save this one.
  const onRelationCreation = () => {
    if ('isDisabled' in form) {
      form.isDisabled = true;
    }
  };

  // Enable the form on cancel
  const onRelationCreationCanceled = () => {
    if ('isDisabled' in form) {
      form.isDisabled = false;
    }
  };

  /** A document created from the field: picked unless the field is full, and the form enabled again. */
  const onRelationCreated = (doc: GenericDoc) => {
    if ('isDisabled' in form) {
      form.isDisabled = false;
    }
    if (isFull) return;
    known = [...known, doc];
    selectedItems = [...selectedItems, documentToRelationFieldItem(doc)];
    field.value = buildRelationFieldValue();
  };

  /** A drag moved a pick from `oldIndex` to `newIndex`. */
  const onOrderChange = (oldIndex: number, newIndex: number) => {
    selectedItems = moveItem(selectedItems, oldIndex, newIndex);
    field.value = buildRelationFieldValue();
    stamp = new Date().getTime().toString();
  };

  /** Picks a document the search found; a full field ignores it. */
  const addValue = (doc: GenericDoc) => {
    if (isFull) return;
    known = [...known, doc];
    selectedItems = [...selectedItems, documentToRelationFieldItem(doc)];
    field.value = buildRelationFieldValue();
  };

  /**
   * The whole selection at once, from the upload picker. A document the field does not hold yet,
   * uploaded meanwhile or found in a folder, comes from the docs the picker has shown.
   */
  const setValue = (next: string[], seen: GenericDoc[]) => {
    known = [...known, ...seen.filter((doc) => next.includes(doc.id))];
    const itemOf = (id: string) =>
      selectedItems.find((item) => item.documentId === id) ??
      (() => {
        const doc = seen.find((candidate) => candidate.id === id);
        return doc ? documentToRelationFieldItem(doc) : undefined;
      })();
    selectedItems = next.map(itemOf).filter((item) => !!item);
    field.value = buildRelationFieldValue();
  };

  /** Removes a pick by its document id. */
  const removeValue = (incomingId: string) => {
    selectedItems = selectedItems.filter((item) => item.documentId !== incomingId);
    field.value = buildRelationFieldValue();
  };

  /** Documents made from files dropped on the field: picked. */
  const addUploaded = (docs: GenericDoc[]) => {
    if (!docs.length) return;
    known = [...known, ...docs];
    const items = docs.map(documentToRelationFieldItem);
    selectedItems = config.get.many ? [...selectedItems, ...items] : items.slice(0, 1);
    field.value = buildRelationFieldValue();
  };

  /** The library picker of an upload relation, opened from the label row. */
  let browsing = $state(false);

  /** The other relations: the label row picks and creates through the list below it. */
  let list = $state<ReturnType<typeof Default>>();
  const user = getUserContext();
  const canCreate = $derived(!!relationConfig.access.create?.(user.attributes, {}));
  const canChoose = $derived(!isFull && hasCandidate);

  const shared = $derived({
    many: !!config.get.many,
    hasError: !!field.error,
    formNestedLevel: 'nestedLevel' in form ? form.nestedLevel : 0,
    readOnly: form.readOnly,
    nothingToSelect,
    onRelationCreated,
    onRelationCreationCanceled,
    onRelationCreation,
    isFull,
    stamp,
    addValue,
    setValue,
    addUploaded,
    selectedItems,
    removeValue,
    relationConfig,
    query,
    onOrderChange
  });
</script>

<fieldset class="rz-field-relation {config.get.className || ''}" use:fieldset={field}>
  <div class="rz-field-relation__head">
    <Field.Label {config} for={path || config.name} />
    {#if !form.readOnly}
      <div class="rz-field-relation__actions">
        {#if isRelationToUpload}
          <Button variant="ghost" size="sm" icon={Images} onclick={() => (browsing = true)}>
            {t__('fields.choose_from_library')}
          </Button>
        {:else}
          {#if canChoose}
            <Button variant="ghost" size="sm" icon={TextSearch} onclick={() => list?.choose()}>
              {t__('fields.choose')}
            </Button>
          {/if}
          {#if canCreate && !isFull}
            <Button variant="ghost" size="sm" icon={Plus} onclick={() => list?.create()}>
              {t__('common.create_new', relationConfig.label.singular || relationConfig.slug)}
            </Button>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
  <Field.Hint {config} />

  {#if isRelationToUpload}
    <Upload {...shared} bind:browsing />
  {:else}
    <Default
      {...shared}
      {canCreate}
      {hasCandidate}
      candidates={found.docs}
      count={found.count}
      bind:search
      bind:searching
      bind:this={list}
    />
  {/if}

  <Field.Error error={field.error} />
</fieldset>

<style lang="postcss">
  .rz-field-relation__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-2);
    min-height: var(--rz-size-7);
    margin-bottom: var(--rz-size-2);

    :global(.rz-field-label) {
      margin-bottom: 0;
      min-width: 0;
    }
  }

  /* Ghost buttons on the label's line, quiet until hovered. */
  .rz-field-relation__actions {
    display: flex;
    align-items: center;
    gap: var(--rz-size-0-5);
    margin-right: --size(-2);

    :global(.rz-button) {
      height: var(--rz-size-6);
      gap: var(--rz-size-1-5);
      padding-inline: var(--rz-size-2);
      color: var(--rz-fg-muted);
      font-size: var(--rz-text-sm);
    }

    :global(.rz-button__icon) {
      width: auto;
      height: auto;
      color: var(--rz-fg-subtle);
    }

    :global(.rz-button:hover:not(:disabled)),
    :global(.rz-button:hover:not(:disabled) .rz-button__icon) {
      color: var(--rz-fg);
    }
  }

  .rz-field-relation__head + :global(.rz-field-hint) {
    margin-top: 0;
    margin-bottom: var(--rz-size-2);
  }

  /* The error sits under the field, clear of the buttons on the label's line. */
  .rz-field-relation > :global(.rz-field-error) {
    position: static;
    display: inline-block;
    margin-top: var(--rz-size-1-5);
  }
</style>
