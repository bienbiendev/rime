import { applyAction, deserialize } from '$app/forms';
import { page } from '$app/state';
import type { BuiltAreaClient, BuiltCollectionClient } from '$lib/core/factory/config/types.js';
import { PARAMS, VERSIONS_STATUS } from '$lib/core/constant.js';
import type { FormFieldBuilder } from '$lib/core/fields/builders/index.js';
import { getFieldAtPath } from '$lib/core/fields/util.js';
import { buildConfigMap } from '$lib/core/operations/config-map/index.js';
import type { AreaSlug, GenericBlock, GenericDoc, TreeBlock } from '$lib/core/types/doc.js';
import { isJSONContent, richTextJSONToText } from '$lib/fields/rich-text/index.js';
import { panelUrl } from '$lib/panel/util/url.js';
import type { FormField } from '$lib/types.js';
import { normalizeFieldPath } from '$lib/util/doc.js';
import { apiUrl, random } from '$lib/util/index.js';
import { isObjectLiteral, omit } from '$lib/util/object.js';
import type { Dic, WithOptional } from '$lib/util/types.js';
import type { ActionResult } from '@sveltejs/kit';
import cloneDeep from 'clone-deep';
import { diff } from 'deep-object-diff';
import { flatten } from 'flat';
import { getContext, setContext } from 'svelte';
import { toast } from 'svelte-sonner';
import { t__ } from '../../core/i18n/index.js';
import { moveItem } from '../../util/array.js';
import { getValueAtPath, setValueAtPath } from '../../util/object.js';
import { snapshot } from '../../util/state.js';
import { getAPIProxyContext } from './api-proxy.svelte.js';
import { setErrorsContext } from './errors.svelte.js';
import { getLocaleContext } from './locale.svelte.js';
import { getTitleContext } from './title.js';
import { getUserContext } from './user.svelte.js';

function createDocumentFormState<T extends WithOptional<GenericDoc, 'id'> = GenericDoc>({
  initial,
  config,
  readOnly,
  key,
  onNestedDocumentCreated,
  afterSuccess,
  onDataChange,
  beforeSubmit,
  beforeRedirect,
  onFieldFocus
}: Args<T>) {
  //
  let initialDoc = $state(initial);
  let doc = $state<T>(initial);
  let formElement = $state<HTMLFormElement>();
  const documentConfig = config;
  const changes = $derived<Partial<GenericDoc>>(diff(initialDoc, doc));
  let isDisabled = $state(readOnly);
  let processing = $state(false);
  const operation = $derived(doc.id ? 'update' : 'create');
  const user = getUserContext();
  const errors = setErrorsContext(key);
  const isCollection = documentConfig.type === 'collection';
  const hasError = $derived(errors.length);
  const canSubmit = $derived(
    !isDisabled && !readOnly && Object.keys(changes).length > 0 && !hasError
  );
  const nestedLevel = initLevel();
  /** onDataChange is only used to trigger action on live-edit so determine if this is a live-edit form */
  const isLiveEdit = !!onDataChange;
  const locale = getLocaleContext();
  const titleContext = getTitleContext();
  const initialTitle = initTitle();
  let title = $state(initialTitle);

  const apiProxy = getAPIProxyContext();

  function initLevel() {
    const last = key.split('_').pop() as string;
    const isDigit = /[\d]+/.test(last);
    return isDigit ? parseInt(last) : 0;
  }

  function initTitle() {
    if (documentConfig.type === 'area') {
      titleContext.value = documentConfig.label;
      return documentConfig.label;
    } else {
      function computeTitleFromValue(value: unknown): string {
        // Handle rich text value
        if (isJSONContent(value)) {
          return richTextJSONToText(value as any);
        }
        if (typeof value === 'string') {
          return value;
        }
        return initialTitle || doc.id || '[untitled]';
      }

      $effect(() => {
        const rawTitle = getValueAtPath(documentConfig.asTitle, doc) || '[untitled]';
        title = computeTitleFromValue(rawTitle);
        if (nestedLevel === 0) {
          titleContext.value = title;
        }
      });
      const initialTitle = getValueAtPath<string>(documentConfig.asTitle, doc);
      return doc && initialTitle ? initialTitle : '[untitled]';
    }
  }

  const rebuildPaths = (items: any[], basePath: string, parentPath: string = basePath) => {
    return items.map((item, index) => {
      // Clone the item
      const newItem = cloneDeep(item);

      // If item has a path property, update it with parent path
      if ('path' in newItem) {
        newItem.path = parentPath;
      }

      // If item is part of an array, update its position
      newItem.position = index;

      // Process all properties of the item
      Object.keys(newItem).forEach((key) => {
        // If property is an array of object, process it recursively
        if (
          Array.isArray(newItem[key]) &&
          newItem[key].length &&
          isObjectLiteral(newItem[key][0])
        ) {
          const newParentPath = `${parentPath}.${index}.${key}`;
          newItem[key] = rebuildPaths(newItem[key], basePath, newParentPath);
        }
      });

      return newItem;
    });
  };

  function setValue(path: string, value: any) {
    doc = setValueAtPath(path, doc, value);
    if (onDataChange) onDataChange({ path, value });
  }

  /**
   * Function that return a possible reactive value given a path.
   *
   * @param path Field path ex: blocks.0.title
   * @returns the document nested value wich can be a $state or anything else
   *
   * @example
   * const form = getDocumentFormContext()
   * const value = form.getValue('blocks.0.title')
   *
   * //value will update if doc.blocks.0.title update
   */
  function getValue<T>(path: string): T | null {
    return getValueAtPath(path, doc) || null;
  }

  function useTree(path: string) {
    // Stamp used for re-render
    let stamp = $state(new Date().getTime().toString());

    const generateTempId = () => 'temp-' + new Date().getTime().toString();

    const getItems = (): TreeBlock[] => {
      return getValueAtPath(path, doc) || [];
    };

    const assignItemsToDoc = (items: TreeBlock[]) => {
      doc = setValueAtPath(path, doc, items);
      if (onDataChange) onDataChange({ path, value: snapshot(items) });
      /** update stamp to rerender */
      stamp = new Date().getTime().toString();
    };

    const addItem = (emptyFields: Dic) => {
      let items = [...getItems()];
      const itemWithPath: TreeBlock = {
        ...emptyFields,
        id: generateTempId(),
        path: path,
        position: items.length,
        _children: []
      };
      items = items.toSpliced(items.length, 0, itemWithPath);
      assignItemsToDoc(items);
    };

    const deleteItem = (atPath: string, index: number) => {
      let items = cloneDeep(snapshot(getItems()));

      // Get target array
      const targetArray =
        getValueAtPath<TreeBlock[]>(atPath.replace(`${path}.`, ''), items) || items;

      // Perform the move operation
      targetArray.splice(index, 1);

      // Rebuild all paths and positions
      items = rebuildPaths(items, path);
      errors.deleteAllThatStartWith(`${path}.${index}.`);
      assignItemsToDoc(items);
    };

    const moveItem = (fromPath: string, toPath: string) => {
      let items = cloneDeep(snapshot(getItems()));

      const getArrayAndIndex = (path: string) => {
        const parts = normalizeFieldPath(path).split('.');
        let current = items;
        let parentArray = items;
        const finalIndex = parseInt(parts[parts.length - 1]);

        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (part === '_children') {
            continue;
          }
          const index = parseInt(part);
          parentArray = current;
          if (!current[index]._children) {
            current[index]._children = [];
          }
          current = current[index]._children;
        }

        return {
          array: parts.includes('_children') ? current : parentArray,
          index: finalIndex,
          fullPath: parts.slice(0, -1).join('.')
        };
      };

      // Get source and target information
      const source = getArrayAndIndex(fromPath);
      const target = getArrayAndIndex(toPath);

      // Perform the move operation
      const [itemToMove] = source.array.splice(source.index, 1);
      target.array.splice(target.index, 0, itemToMove);

      // Rebuild paths and positions
      items = rebuildPaths(items, path);
      assignItemsToDoc(items);
    };

    return {
      addItem,
      moveItem,
      deleteItem,
      path,
      get stamp() {
        return stamp;
      },
      get items() {
        return getItems();
      }
    };
  }

  function useBlocks(path: string) {
    const generateTempId = () => 'temp-' + new Date().getTime().toString();

    const getBlocks = (): GenericBlock[] => {
      return cloneDeep(getValueAtPath(path, doc)) || [];
    };

    const assignBlocksToDoc = (blocks: GenericBlock[]) => {
      blocks = rebuildPaths(blocks, path);
      doc = setValueAtPath(path, doc, blocks);
      if (onDataChange) onDataChange({ path, value: snapshot(blocks) });
    };

    const addBlock: AddBlock = (block) => {
      const blockWithPath: GenericBlock = {
        ...block,
        id: generateTempId(),
        type: block.type,
        path: path,
        position: block.position
      };
      let blocks = [...getBlocks()];
      blocks = blocks.toSpliced(block.position, 0, blockWithPath);
      assignBlocksToDoc(blocks);
    };

    const deleteBlock = (index: number) => {
      const blocks = [...getBlocks()]
        .filter((_, i) => i !== index)
        .map((block, index) => ({ ...block, position: index }));
      errors.deleteAllThatStartWith(`${path}.${index}.`);
      assignBlocksToDoc(blocks);
    };

    const moveBlock: MoveBlock = (from, to) => {
      let blocks = moveItem(getBlocks(), from, to);
      blocks = blocks.map((block, index) => ({
        ...block,
        position: index
      }));
      assignBlocksToDoc(blocks);
    };

    const duplicateBlock = (index: number) => {
      // return;
      let blocks = [...getBlocks()];

      const cloneBlock = <T extends Record<string, any>>(block: T) => {
        // First deep clone the block so duplicate origin
        // is not impacted.
        const clone = cloneDeep<T>(block);
        // Function to reset all nested id properties
        // so nested elements are threated as created elements
        const resetIds = <O extends Record<string, any>>(obj: O) => {
          if ('id' in obj) {
            obj = { ...obj, id: generateTempId() };
          }
          for (const key of Object.keys(obj)) {
            const value = obj[key];
            if (Array.isArray(value) && value.length && isObjectLiteral(value[0])) {
              obj = {
                ...obj,
                [key]: value.map((child) => resetIds(child))
              };
            }
          }
          return obj;
        };
        // set temp-ids for nested elements
        return resetIds(clone);
      };

      const blockCopy = cloneBlock(blocks[index]);

      blocks.splice(index + 1, 0, blockCopy);
      blocks = blocks.map((block, index) => ({
        ...block,
        position: index
      }));
      assignBlocksToDoc(blocks);
    };

    return {
      addBlock,
      deleteBlock,
      moveBlock,
      duplicateBlock,

      get blocks() {
        return getBlocks();
      }
    };
  }

  /**
   * Function that return an unreactive snapshot of a value given a path.
   *
   * @param path Field path ex: blocks.0.title
   * @returns an unreactive snapshot
   *
   * @example
   * const form = getDocumentFormContext()
   * const initialValue = form.getRawValue('blocks.0.title')
   *
   * // value will not update if doc.blocks.0.title update
   */
  function getRawValue<T>(path: string) {
    return (snapshot(getValueAtPath(path, doc)) as T) || null;
  }

  // Recursively remove id property from blocks/tree/relations
  // This ensure elements to be threated as new,
  // preventing an unwanted delete or update with the wrong locale
  const removeIds = <T>(data: T): T => {
    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => removeIds(item)) as unknown as T;
    }
    // Handle objects
    if (typeof data === 'object' && data !== null) {
      // First omit the id and locale properties
      const withoutId = omit(['id', 'locale'], data as Dic);
      const result: Dic = { ...withoutId, id: 'temp-' + random.randomId(8) };
      // Replace with the current locale if present
      if (locale.code && 'locale' in data) {
        result.locale = locale.code;
      }
      // Then recursively process all remaining properties
      for (const key in result) {
        if (key !== 'id' && typeof result[key] === 'object' && result[key] !== null) {
          result[key] = removeIds(result[key]);
        }
      }
      return result as unknown as T;
    }
    // Return primitive values as is
    return data;
  };

  /**
   * `config` is the raw compiled field data, same as every field component
   * (Text.svelte, Group.svelte, ...) already works with — this mirrors
   * `form.svelte.ts`'s `useField` on purpose, since both read plain field
   * data (`.required`, `.isEmpty(value)`, `.validate(...)`, `.access.read`,
   * `.condition(...)`), never builder methods. `config` is only omitted by
   * callers with just a path in hand (e.g. `Group.svelte`'s `getField`), in
   * which case it's resolved from `documentConfig.fields` and unwrapped via
   * `.get` — the field must exist in the document's own field tree for that
   * to work, which doesn't hold for standalone fields like the panel's
   * password inputs (see AuthFooter.svelte), so those always pass `config`.
   */
  function useField<TValue>(path: string, config?: FormFieldBuilder<FormField>) {
    if (!config) {
      const resolved = getFieldAtPath(path, documentConfig.fields);
      if (!resolved) throw new Error(`can't find config for field : ${path}`);
      config = resolved;
    }

    path = path ? normalizeFieldPath(path) : config.name;

    const parts = $derived(path.split('.'));

    const validate = (value: any) => {
      if (config.get.required && config.use.isEmpty(value)) {
        errors.set(path, 'required::required_field');
        return 'required';
      }

      const validated = config.use.validate(value, {
        data: doc,
        locale: locale.code,
        id: doc.id ?? undefined,
        operation: doc.id ? 'update' : 'create',
        user: user.attributes,
        config: config.get
      });

      if (validated !== true) {
        errors.set(path, validated);
        return false;
      }

      if (errors.has(path)) {
        errors.delete(path);
      }
      return true;
    };

    const getSiblings = () => {
      let siblings: Dic = doc;
      if (parts.length > 1) {
        const upperPath = path.substring(0, path.lastIndexOf('.'));
        siblings = getValueAtPath(upperPath, doc) || {};
      }
      return siblings;
    };

    const setValueFromDefaultLocale = async () => {
      const BASE_API_URL = apiUrl(documentConfig.kebab);
      let fetchURL: string = BASE_API_URL;
      const draftParam = doc.status === VERSIONS_STATUS.DRAFT ? '&draft=true' : '';
      if (isCollection) {
        fetchURL += `?where[id][equals]=${doc.id}&locale=${locale.defaultCode}${draftParam}`;
      } else {
        fetchURL += `?locale=${locale.defaultCode}${draftParam}`;
      }

      // Fetch data
      const result = await fetch(fetchURL).then((r) => r.json());
      // Process data
      if ((isCollection && Array.isArray(result.docs) && result.docs.length) || result.doc) {
        // Extract data from the appropriate response structure:
        // - For collections: data is in result.docs[0]
        // - For areas: data is in result.doc
        const document = isCollection ? result.docs[0] : result.doc;
        const defaultLocaleValue = getValueAtPath<Dic[]>(path, document) || [];

        // Remove ids from blocks before setting the value
        setFieldValue(removeIds(defaultLocaleValue));
      }
    };

    const setFieldValue = async (value: any) => {
      value = await config.use.beforeValidate(value, { config, data: doc });
      const valid = validate(value);

      if (operation === 'update' && !config.use.accessUpdate(user.attributes)) {
        return;
      }

      if (valid) {
        setValue(path, value);
        config.use.onChange?.(value, {
          siblings: getSiblings(),
          useField,
          useBlocks,
          useTree
        });
      }
    };

    return {
      path,
      setValueFromDefaultLocale,

      get value(): TValue | undefined {
        return getValueAtPath<TValue>(path, doc);
      },

      set value(value: TValue | null) {
        setFieldValue(value);
      },

      get editable() {
        if (readOnly) return false;
        if (operation === 'create') {
          return !!config.use.accessCreate?.(user.attributes);
        } else {
          return !!config.use.accessUpdate?.(user.attributes);
        }
      },

      get visible() {
        if (!config.use.accessRead(user.attributes)) {
          return false;
        }
        return config.use.isVisible(doc, getSiblings());
      },

      get error() {
        return errors.value[path] || false;
      },

      get isEmpty() {
        return config.use.isEmpty(getValueAtPath(path, doc));
      }
    };
  }

  /**
   * Prepare the form data for submission.
   * This function collects the changed fields from the document,
   * applies any beforeSubmit hooks, and constructs a FormData object
   * to be sent in the request body.
   */
  const prepareData = async () => {
    let data: Dic = {};
    for (const key of Object.keys(changes)) {
      data[key] = doc[key];
    }

    if (beforeSubmit) {
      data = await beforeSubmit(data);
    }

    const flatData: Dic = flatten(data);

    const formData = new FormData();
    for (const key of Object.keys(flatData)) {
      let value = flatData[key];
      // Prevent empty array to be passed to formData as empty string
      if (Array.isArray(value) && value.length === 0) {
        value = '[]';
      }
      formData.set(key, value);
    }

    if (isCollection && documentConfig.upload) {
      const uploadPath = page.url.searchParams.get(PARAMS.UPLOAD_PATH);
      formData.set('_path', uploadPath || 'root');
    }

    return formData;
  };

  /**
   * Submit the form data to the server.
   */
  const submit = async (action: string) => {
    if (processing) return;
    processing = true;

    const result: ActionResult<FormSuccessData> = await fetch(action, {
      method: 'POST',
      body: await prepareData()
    }).then(async (r) => deserialize(await r.text()));

    async function handleSuccess(data?: FormSuccessData) {
      const redirect = data?.redirectUrl || false;
      const message = data?.message || t__('common.generic_success');
      // Invalidate all queries to ensure data consistency across the app
      apiProxy.invalidate(documentConfig.slug);

      if (redirect) {
        if (beforeRedirect) {
          const shouldRedirect = await beforeRedirect(data);
          toast.success(message);
          if (!shouldRedirect) return;
        }
        return applyAction({ type: 'redirect', location: redirect, status: 301 });
      }

      // Assign documents returned from the server to the form state
      doc = (data?.document || doc) as T;
      initialDoc = doc;
      toast.success(message);

      // Callbacks
      if (nestedLevel !== 0) {
        if (onNestedDocumentCreated) onNestedDocumentCreated(doc);
      }
      if (afterSuccess) afterSuccess(doc);
    }

    async function handleError(data?: Dic) {
      // Handle error
      if (data?.errors) {
        errors.value = data.errors;
        for (const [key, error] of Object.entries(errors.value)) {
          toast.error(key + ': ' + error);
        }
      } else {
        toast.error('An error occured');
      }
    }

    switch (result.type) {
      case 'success':
        handleSuccess(result.data);
        break;
      case 'failure':
        handleError(result.data);
        break;
    }

    processing = false;
  };

  /**
   * Enhance the form element to handle submission.
   * This function attaches a submit event listener to the form element,
   * which prevents the default submission behavior, sets the status field
   * if applicable, and calls the submit function with the appropriate action URL.
   */
  const enhance = (node: HTMLFormElement) => {
    // Assign form element
    formElement = node;
    // Set status field if submitter has a data-status attribute
    const setStatus = (submitter: SubmitEvent['submitter']) => {
      const SUBMITER_HAS_DATA_STATUS = !!submitter?.dataset.status;
      if (SUBMITER_HAS_DATA_STATUS && documentConfig.versions && documentConfig.versions.draft) {
        setValue('status', submitter?.dataset.status);
      }
    };
    // Build full action URL with query params based on submitter attributes (draft, versionId)
    const enhanceAction = (submitter: SubmitEvent['submitter']) => {
      let actionUrl = buildPanelActionUrl();
      const SUBMITER_HAS_DATA_DRAFT = !!submitter?.dataset.draft;
      const DOC_HAS_VERSION = documentConfig.versions && !!doc.versionId;
      const { DRAFT, VERSION_ID } = PARAMS;

      if (SUBMITER_HAS_DATA_DRAFT) {
        actionUrl += `&${DRAFT}=true`;
      } else if (DOC_HAS_VERSION) {
        actionUrl += `&${VERSION_ID}=${doc.versionId}`;
      }

      return actionUrl;
    };

    const listener = async (event: SubmitEvent) => {
      event.preventDefault();
      setStatus(event.submitter);
      submit(enhanceAction(event.submitter));
    };

    node.addEventListener('submit', listener);

    return {
      destroy() {
        node.removeEventListener('submit', listener);
      }
    };
  };

  /**
   * Build the action URL for the form submission based on the current operation (create or update),
   * the document type (collection or area), and any nested form levels.
   * This function constructs the appropriate URL to which the form data will be submitted.
   */
  const buildPanelActionUrl = () => {
    // Start with the base URI for the panel, adding the item ID if we're updating a collection doc
    const panelUri =
      operation === 'update' && initial._prototype === 'collection' && initial.id
        ? panelUrl(config.kebab, initial.id)
        : panelUrl(config.kebab);
    // Determine the appropriate action based on whether we're creating or updating
    const actionSuffix = operation === 'create' ? '/create?/create' : '?/update';
    // Add a redirect parameter if we're in a nested form ex: relation creation
    // to prevent redirect after creation
    const redirectParam = nestedLevel > 0 ? `&${PARAMS.REDIRECT}=false` : '';
    // Combine all parts to form the final action URL
    return `${panelUri}${actionSuffix}${redirectParam}`;
  };

  /**
   * Import data from the default locale for the current document.
   * This function fetches the document data from the default locale and updates the current document state.
   * It processes localized fields to ensure they are correctly set for the current locale.
   */
  const importDataFromDefaultLocale = async () => {
    const BASE_API_URL = `${apiUrl(documentConfig.kebab)}`;
    let fetchURL: string = BASE_API_URL;
    const draftParam = doc.status === VERSIONS_STATUS.DRAFT ? '&draft=true' : '';
    if (isCollection) {
      fetchURL += `?where[id][equals]=${doc.id}&locale=${locale.defaultCode}${draftParam}`;
    } else {
      fetchURL += `?locale=${locale.defaultCode}${draftParam}`;
    }
    // Fetch data
    const result = await fetch(fetchURL).then((r) => r.json());
    // Process data
    if ((isCollection && Array.isArray(result.docs) && result.docs.length) || result.doc) {
      const defaultLocaleDoc = isCollection ? result.docs[0] : result.doc;
      let data = { ...defaultLocaleDoc, locale: locale.code };
      const configMap = buildConfigMap(defaultLocaleDoc, documentConfig.fields);
      for (const [key, field] of Object.entries(configMap)) {
        if (field.get.localized) {
          let value = getValueAtPath<Dic[]>(key, data);
          value = removeIds(value);
          data = setValueAtPath(key, data, value);
        }
      }
      doc = data;
    }
  };

  return {
    key,
    setValue,
    getRawValue,
    enhance,
    useField,
    getValue,
    useBlocks,
    useTree,
    nestedLevel,
    buildPanelActionUrl,
    readOnly,
    importDataFromDefaultLocale,

    get isDisabled() {
      return isDisabled;
    },

    set isDisabled(bool: boolean) {
      isDisabled = bool;
    },

    get element() {
      if (!formElement) throw new Error('form element is not defined');
      return formElement;
    },

    get canSubmit() {
      return canSubmit;
    },

    get processing() {
      return processing;
    },

    get values() {
      return doc;
    },

    get changes() {
      return changes;
    },

    get errors() {
      return errors;
    },

    set values(v) {
      doc = v;
    },

    get config() {
      return config;
    },

    get title() {
      return title;
    },

    get isLive() {
      return isLiveEdit;
    },

    reset() {
      doc = initialDoc;
    },

    setFocusedField(path: string) {
      if (isLiveEdit && onFieldFocus) {
        onFieldFocus(path);
      }
    }
  };
}

const FORM_KEY = 'rime.form';

export function setDocumentFormContext<T extends WithOptional<GenericDoc, 'id'>>(args: Args<T>) {
  const initial = {
    ...args.initial,
    _type: args.initial._type || args.config.type,
    _prototype: args.initial._prototype || args.config.slug
  };
  const store = createDocumentFormState({ ...args, initial });
  return setContext(`${FORM_KEY}.${args.key}`, store);
}

export function getDocumentFormContext<
  T extends WithOptional<GenericDoc, 'id'> = WithOptional<GenericDoc, 'id'>
>(key: string = 'root') {
  return getContext<DocumentFormContext<T>>(`${FORM_KEY}.${key}`);
}

export type DocumentFormContext<
  T extends WithOptional<GenericDoc, 'id'> = WithOptional<GenericDoc, 'id'>
> = ReturnType<typeof setDocumentFormContext<T>>;

type AddBlock = (block: Omit<GenericBlock, 'id' | 'path'>) => void;
type MoveBlock = (from: number, to: number) => void;
export type FormSuccessData = { redirectUrl?: string; document?: GenericDoc; message?: string };

type Args<T> = {
  beforeSubmit?: (data: Dic) => Promise<Dic>;
  beforeRedirect?: (data?: FormSuccessData) => Promise<boolean>;
  afterSuccess?: (doc?: T) => void;
  initial: T;
  config: (AreaSlug extends never ? never : BuiltAreaClient) | BuiltCollectionClient;
  readOnly: boolean;
  onDataChange?: any;
  onNestedDocumentCreated?: any;
  onFieldFocus?: any;
  key: string;
};
