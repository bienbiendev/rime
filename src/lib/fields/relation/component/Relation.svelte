<script lang="ts">
  import { apiUrl } from '$lib/core/api/index.js';
  import { isUploadConfig } from '$lib/core/collections/upload/util/config.js';
  import type { GenericDoc } from '$lib/core/types/doc.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import { root } from '$lib/panel/components/fields/root.svelte.js';
  import { getCollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { type DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte';
  import { panelUrl } from '$lib/panel/util/url.js';
  import { moveItem } from '$lib/util/array.js';
  import { snapshot } from '$lib/util/state.js';
  import { getAPIProxyContext } from '../../../panel/context/api-proxy.svelte.js';
  import type { Relation, RelationField } from '../index.js';
  import Default from './default/Default.svelte';
  import type { RelationFieldItem } from './types.js';
  import Upload from './upload/Upload.svelte';

  // Props
  type Props = { path: string; config: RelationField; form: DocumentFormContext };
  const { path, config, form }: Props = $props();

  // Context
  const { getCollection } = getConfigContext();
  const locale = getLocaleContext();
  const APIProxy = getAPIProxyContext();
  const field = $derived(form.useField(path, config));
  // svelte-ignore state_referenced_locally
  const relationConfig = getCollection(config.relationTo);
  const relationCollectionCtx = getCollectionContext(relationConfig.slug);

  let initialized = $state(false);
  // the fetched items
  let initialItems: RelationFieldItem[] = $state([]);
  // value from the form
  let initialValue = $derived(form.getRawValue<Relation[]>(path) || []);
  // timestamp to force re-render
  let stamp = $state(new Date().getTime().toString());

  let selectedItems = $state<RelationFieldItem[]>([]);
  // fetched items minus selected items
  let availableItems = $state<RelationFieldItem[]>([]);
  const nothingToSelect = $derived(initialItems.length === 0);

  let isFull = $derived.by(() => {
    if (!config.many) {
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
      editUrl: panelUrl(relationConfig.kebab, doc.id),
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
    if (form.isLive) {
      item.livePreview = doc;
    }
    return item;
  }

  // Build the API URL for fetching the collection
  function makeRessourceURL() {
    const url = new URL(apiUrl(relationConfig.kebab));

    // Add depth parameter if in live context
    if (form.isLive) {
      url.searchParams.append('depth', '1');
    }

    // Add custom query parameters if provided
    if (config.query) {
      if (typeof config.query === 'string') {
        // Parse the query string and add each parameter
        const queryParams = new URLSearchParams(config.query);
        queryParams.forEach((value, key) => {
          url.searchParams.append(key, value);
        });
      } else if (typeof config.query === 'function') {
        // Parse the function result and add each parameter
        const queryString = config.query(form.values);
        const queryParams = new URLSearchParams(queryString);
        queryParams.forEach((value, key) => {
          url.searchParams.append(key, value);
        });
      }
    }
    return url.href;
  }

  const ressourceURL = makeRessourceURL();

  // Fetch the collection data
  const ressource = APIProxy.getRessource<{ docs: GenericDoc[] }>(ressourceURL);

  // Initialize the initial items and selected items
  $effect(() => {
    if (ressource.data) {
      initialItems = ressource.data.docs.map((doc: GenericDoc) => documentToRelationFieldItem(doc));
      if (!initialized) {
        const findItem = (relation: Relation) => {
          return initialItems.find((item) => item.documentId === relation.documentId);
        };
        selectedItems = initialValue.map(findItem).filter((item) => !!item);
        initialized = true;
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
    const relations = selectedItems.map((item, index) => {
      let relation: Omit<Relation, 'ownerId'> = {
        id: item.id,
        relationTo: config.relationTo,
        path,
        position: index,
        documentId: item.documentId
      };
      if (config.localized) {
        relation.locale = locale.code;
      }
      if (form.isLive) {
        if (item && item.livePreview) {
          relation.livePreview = snapshot(item.livePreview);
        }
      }
      return relation;
    });

    return relations;
  };

  // Disabled the parent form (this one)
  // So when user save the nested doc
  // it doesn't save this one
  const onRelationCreation = () => {
    form.isDisabled = true;
  };

  // Enable the form on cancel
  const onRelationCreationCanceled = () => {
    form.isDisabled = false;
  };

  const onRelationCreated = async (doc: GenericDoc) => {
    // Enabled the form
    form.isDisabled = false;
    // update resssource
    ressource.data?.docs.push(doc);
    // update collection if present
    if (relationCollectionCtx) {
      relationCollectionCtx.addDoc(doc);
    }
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

  const removeValue = async (incomingId: string) => {
    selectedItems = selectedItems.filter((item) => item.documentId !== incomingId);
    field.value = buildRelationFieldValue();
  };

  const isRelationToUpload = isUploadConfig(relationConfig);
  const RelationComponent = isRelationToUpload ? Upload : Default;
</script>

<fieldset class="rz-field-relation {config.className || ''}" use:root={field}>
  <Field.Label {config} for={path || config.name} />
  <Field.Hint {config} />

  <RelationComponent
    {path}
    many={!!config.many}
    hasError={!!field.error}
    formNestedLevel={form.nestedLevel}
    readOnly={form.readOnly}
    {nothingToSelect}
    {onRelationCreated}
    {onRelationCreationCanceled}
    {onRelationCreation}
    {isFull}
    {stamp}
    {addValue}
    {availableItems}
    {selectedItems}
    {removeValue}
    {relationConfig}
    {onOrderChange}
  />

  <Field.Error error={field.error} />
</fieldset>
