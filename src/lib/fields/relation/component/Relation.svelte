<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { isUploadConfig } from '$lib/core/prototype/collection/upload/util/config.js';
  import type { GenericDoc } from '$lib/core/prototype/types.js';
  import { apiUrl, panelPath } from '$lib/core/routes/util.js';
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { type DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import type { FormContext } from '$lib/panel/context/form.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte';
  import { getUserContext } from '$lib/panel/context/user.svelte.js';
  import { moveItem } from '$lib/util/array.js';
  import { snapshot } from '$lib/util/state.js';
  import { Images, Plus, TextSearch } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import { getAPIProxyContext } from '../../../panel/context/api-proxy.svelte.js';
  import type { RelationFieldBuilder, RelationRow } from '../index.js';
  import { Relation } from '../relation.js';
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
  const APIProxy = getAPIProxyContext();
  const field = $derived(form.useField(path, config));
  // svelte-ignore state_referenced_locally
  const relationConfig = getCollection(config.get.relationTo);

  let initialized = $state(false);
  // the fetched items
  let initialItems: RelationFieldItem[] = $state([]);
  // value from the form
  let initialValue = $derived(form.getRawValue<RelationRow[]>(path) || []);
  // timestamp to force re-render
  let stamp = $state(new Date().getTime().toString());

  let selectedItems = $state<RelationFieldItem[]>([]);
  // fetched items minus selected items
  let availableItems = $state<RelationFieldItem[]>([]);
  const nothingToSelect = $derived(initialItems.length === 0);

  let isFull = $derived.by(() => {
    if (!config.get.many) {
      if (selectedItems.length === 1) return true;
    } else {
      if (availableItems.length === 0 && selectedItems.length > 0) {
        return true;
      }
    }
    return false;
  });

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
    if ('isLive' in form && form.isLive) {
      item.livePreview = doc;
    }
    return item;
  }

  // Build the API URL for fetching the collection
  function makeRessourceURL() {
    const params: [string, string][] = [];

    // Add depth parameter if in live context
    if ('isLive' in form && form.isLive) {
      params.push(['depth', '1']);
    }

    // Add custom query parameters if provided
    if (config.get.query) {
      const query =
        typeof config.get.query === 'function' ? config.get.query(form.values) : config.get.query;
      new URLSearchParams(query).forEach((value, key) => params.push([key, value]));
    }

    const path = apiUrl(relationConfig.kebab);
    const search = new URLSearchParams(params).toString();
    return search ? `${path}?${search}` : path;
  }

  const ressourceURL = makeRessourceURL();

  // Fetch the collection data
  const ressource = APIProxy.getRessource<{ docs: GenericDoc[] }>(ressourceURL);

  // Initialize the initial items and selected items
  $effect(() => {
    if (ressource.data) {
      initialItems = ressource.data.docs.map((doc: GenericDoc) => documentToRelationFieldItem(doc));
      if (!initialized) {
        const findItem = (relation: RelationRow) => {
          return initialItems.find((item) => item.documentId === relation.documentId);
        };
        selectedItems = initialValue.map(findItem).filter((item) => !!item);
        initialized = true;

        // A saved relation the candidates leave out, the field's `query()` no longer matching it,
        // is read on its own: it stays picked, and the next change writes it back.
        const missing = initialValue.filter((relation) => !findItem(relation));
        if (missing.length) {
          const order = initialValue.map((relation) => relation.documentId);
          Promise.resolve(Relation.resolve<GenericDoc>(missing).all()).then((docs) => {
            selectedItems = [...selectedItems, ...docs.map(documentToRelationFieldItem)].sort(
              (a, b) => order.indexOf(a.documentId) - order.indexOf(b.documentId)
            );
          });
        }
      }
    }
  });

  const retreiveRelation = (documentId: string) => {
    if (initialValue && Array.isArray(initialValue) && initialValue.length) {
      for (const relation of initialValue) {
        if (relation.documentId === documentId) {
          return relation;
        }
      }
    }
    return null;
  };

  // The value changed elsewhere, a render beside the field picking in place: the picks follow.
  // A change of the field's own ends here equal to its picks and changes nothing.
  $effect(() => {
    if (!initialized) return;
    const ids = initialValue.map((relation) => relation.documentId);
    untrack(() => {
      const current = selectedItems.map((item) => item.documentId);
      if (ids.join() === current.join()) return;
      const itemOf = (id: string) =>
        selectedItems.find((item) => item.documentId === id) ??
        initialItems.find((item) => item.documentId === id);
      selectedItems = ids.map(itemOf).filter((item) => !!item);
    });
  });

  const getAvailableItems = () => {
    return initialItems.filter(
      (initialItem) =>
        !selectedItems.some((selectedItem) => selectedItem.documentId === initialItem.documentId)
    );
  };

  $effect(() => {
    availableItems = getAvailableItems();
  });

  // Actions
  const buildRelationFieldValue = () => {
    const live = 'isLive' in form && form.isLive;
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

  // Disabled the parent form (this one)
  // So when user save the nested doc
  // it doesn't save this one
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

  const onRelationCreated = async (doc: GenericDoc) => {
    // Enabled the form
    if ('isDisabled' in form) {
      form.isDisabled = false;
    }
    // update resssource
    ressource.data?.docs.push(doc);
    // Set value if not full
    if (isFull) return;
    selectedItems = [...selectedItems, documentToRelationFieldItem(doc)];
    field.value = buildRelationFieldValue();
  };

  const onOrderChange = async (oldIndex: number, newIndex: number) => {
    selectedItems = moveItem(selectedItems, oldIndex, newIndex);
    field.value = buildRelationFieldValue();
    stamp = new Date().getTime().toString();
  };

  const addValue = async (documentId: string) => {
    if (isFull) return;
    const itemToAdd = availableItems.find((item) => item.documentId === documentId);
    if (!itemToAdd) {
      throw new Error(`Can't find relation at ${path}`);
    }
    selectedItems = [...selectedItems, itemToAdd];
    field.value = buildRelationFieldValue();
  };

  /**
   * The whole selection at once, from the upload picker. A document the field did not fetch yet,
   * uploaded meanwhile or found in a folder, comes from the docs the picker has shown.
   */
  const setValue = (ids: string[], seen: GenericDoc[]) => {
    const itemOf = (id: string) =>
      selectedItems.find((item) => item.documentId === id) ??
      initialItems.find((item) => item.documentId === id) ??
      (() => {
        const doc = seen.find((candidate) => candidate.id === id);
        return doc ? documentToRelationFieldItem(doc) : undefined;
      })();
    selectedItems = ids.map(itemOf).filter((item) => !!item);
    field.value = buildRelationFieldValue();
  };

  const removeValue = async (incomingId: string) => {
    selectedItems = selectedItems.filter((item) => item.documentId !== incomingId);
    field.value = buildRelationFieldValue();
  };

  /** Documents made from files dropped on the field: listed from now on, and picked. */
  const addUploaded = (docs: GenericDoc[]) => {
    if (!docs.length) return;
    ressource.data?.docs.push(...docs);
    const items = docs.map(documentToRelationFieldItem);
    selectedItems = config.get.many ? [...selectedItems, ...items] : items.slice(0, 1);
    field.value = buildRelationFieldValue();
  };

  const isRelationToUpload = isUploadConfig(relationConfig);
  /** The library picker of an upload relation, opened from the label row. */
  let browsing = $state(false);

  /** The other relations: the label row picks and creates through the list below it. */
  let list = $state<ReturnType<typeof Default>>();
  const user = getUserContext();
  const canCreate = $derived(!!relationConfig.access.create?.(user.attributes, {}));
  const canChoose = $derived(!isFull && availableItems.length > 0);

  const shared = $derived({
    path,
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
    availableItems,
    selectedItems,
    removeValue,
    relationConfig,
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
    <Default {...shared} {canCreate} bind:this={list} />
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
