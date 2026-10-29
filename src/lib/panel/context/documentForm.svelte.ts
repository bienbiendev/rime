import { documentSegments } from '../util/url.js';
import { UPLOAD_PATH } from '#lib/core/prototype/collection/upload/constant.js';
import { applyAction, deserialize } from '$app/forms';
import { replaceState } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import type { BuiltAreaClient, BuiltCollectionClient } from '#lib/core/config/types.js';
import { PARAMS } from '#lib/core/constants.js';
import type { FormFieldBuilder } from '#lib/core/fields/builders/index.js';
import { getFieldAtPath } from '#lib/core/fields/util.js';
import { buildConfigMap } from '#lib/core/pipeline/config-map/index.js';
import {
  AUTO_SAVE_DELAY_MS,
  VERSIONS_STATUS
} from '#lib/core/prototype/shared/versions/constant.js';
import type { AreaSlug, GenericBlock, GenericDoc, TreeBlock } from '#lib/core/prototype/types.js';
import { apiUrl, panelUrl } from '#lib/core/routes/util.js';
import type { BlocksBuilder } from '#lib/fields/blocks/index.js';
import { isJSONContent } from '#lib/fields/rich-text/json.js';
import type { FormField } from '#lib/types.js';
import { isObjectLiteral, omit } from '#lib/util/object.js';
import { writeFormData } from '#lib/util/form-data.js';
import { normalizeFieldPath } from '#lib/util/string.js';
import type { Dic, WithOptional } from '#lib/util/types.js';
import type { ActionResult } from '$app/forms';
import { diff } from 'deep-object-diff';
import { setContext } from 'svelte';
import { toast } from 'svelte-sonner';
import { SvelteURLSearchParams } from 'svelte/reactivity';
import { t__ } from '../../core/i18n/index.js';
import { getValueAtPath, setValueAtPath } from '../../util/object.js';
import { snapshot } from '../../util/state.js';
import { getAPIProxyContext } from './api-proxy.svelte.js';
import {
  duplicateBlock as duplicateBlockIn,
  fromClipboard,
  insertBlock,
  mergeTypedSince,
  moveBlock as moveBlockIn,
  parseBlockPath,
  readList,
  rekeyErrors,
  removeBlock,
  toClipboard,
  withBlockTypes,
  withFreshIds,
  type BlockAt,
  type NewBlock
} from './blocks-ops.js';
import {
  addItem as addItemIn,
  deleteItem as deleteItemIn,
  moveItem as moveItemIn
} from './tree-ops.js';
import { createErrorsStore } from './errors.svelte.js';
import { getLocaleContext } from './locale.svelte.js';
import { getTitleContext } from './title.js';
import { errorText } from '../util/error-text.js';
import { titleText } from '../util/title.js';
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
  beforeRedirect
}: Args<T>) {
  let initialDoc = $state(initial);
  let doc = $state<T>(initial);
  let formElement = $state<HTMLFormElement>();
  const documentConfig = config;
  const changes = $derived<Partial<GenericDoc>>(diff(initialDoc, doc));
  let isDisabled = $state(readOnly);
  let processing = $state(false);
  /**
   * Read off `initialDoc`, not the live `doc`: a create form may write `id` as a field before the
   * row exists — an upload directory's id is its path, typed in as its name — and that does not
   * make it an update. `initialDoc` gains an id when the server answers with the created row.
   */
  const operation = $derived(initialDoc.id ? 'update' : 'create');
  const user = getUserContext();
  const errors = createErrorsStore();
  const isCollection = documentConfig.type === 'collection';
  const hasError = $derived(errors.length);
  const hasChanges = $derived(Object.keys(changes).length > 0);
  /** `status` is a save's business: an auto-save is always a draft, so it never carries one. */
  const autoSavable = $derived(Object.keys(changes).some((key) => key !== 'status'));
  const nestedLevel = initLevel();
  /** onDataChange is only used to trigger action on live-edit so determine if this is a live-edit form */
  const isLiveEdit = !!onDataChange;
  /**
   * Whether typing here lands in the user's own auto-saved row: a config that opts in, an
   * existing document, a writable form, and the root form — a relation's nested create is never
   * auto-saved. Live edit is the same form and follows the same rule.
   */
  const isAutoSave = $derived(
    !!documentConfig.versions?.draft &&
      !!documentConfig.versions?.autoSave &&
      operation === 'update' &&
      !readOnly &&
      nestedLevel === 0
  );
  /** After an auto-save `changes` is empty, and Save must still turn the row into a version. */
  const canSubmit = $derived(
    !isDisabled && !readOnly && (hasChanges || !!doc.isAutoSave) && !hasError
  );
  const locale = getLocaleContext();
  const titleContext = getTitleContext();
  const initialTitle = getValueAtPath<string>(documentConfig.asTitle, doc);
  /**
   * The area's label, or the `asTitle` value as text. A value that is neither text nor rich text
   * falls back to the value the form opened with, then the id.
   */
  const title = $derived.by(() => {
    if (documentConfig.type === 'area') return documentConfig.label;
    const value = getValueAtPath(documentConfig.asTitle, doc) || '';
    if (typeof value === 'string' || isJSONContent(value)) return titleText(value);
    return initialTitle || doc.id || '';
  });

  // The root form names the page.
  $effect(() => {
    if (nestedLevel === 0) titleContext.value = title;
  });

  const apiProxy = getAPIProxyContext();

  /** How deep the form sits: the number after the last `_` of `key` (`pages_2` -> 2), else 0. */
  function initLevel() {
    const last = key.split('_').pop() as string;
    const isDigit = /[\d]+/.test(last);
    return isDigit ? parseInt(last) : 0;
  }

  /** Sets the value at `path`, and hands it to live edit when the form is a live one. */
  function setValue(path: string, value: any) {
    doc = setValueAtPath(path, doc, value);
    if (onDataChange) onDataChange({ path, value });
  }

  /** Takes a value the server already holds: sets it without making the form dirty. */
  function sync(path: string, value: unknown) {
    doc = setValueAtPath(path, doc, value);
    initialDoc = setValueAtPath(path, initialDoc, value);
  }

  /**
   * The document's value at `path`, or `null` for a falsy one. Read in a `$derived`, it follows
   * the document: `form.getValue('blocks.0.title')`.
   */
  function getValue<T>(path: string): T | null {
    return getValueAtPath(path, doc) || null;
  }

  /**
   * The tree field at `path`, as add, delete and move. `addItem` and `deleteItem` name a list by
   * its full path, `links.0._children`; `moveItem` names items relative to the tree,
   * `0._children.1`.
   */
  function useTree(path: string) {
    // Stamp used for re-render
    let stamp = $state(new Date().getTime().toString());

    const getItems = (): TreeBlock[] => {
      return getValueAtPath(path, doc) || [];
    };

    const assignItemsToDoc = (items: TreeBlock[]) => {
      const next = setValueAtPath(path, doc, items);
      errors.value = rekeyErrors(errors.value, doc, next);
      doc = next;
      if (onDataChange) onDataChange({ path, value: snapshot(items) });
      /** update stamp to rerender */
      stamp = new Date().getTime().toString();
    };

    /** A new item at the end of a list: the tree's own, or one inside an item, `links.0._children`. */
    const addItem = (emptyFields: Dic, atPath: string = path) => {
      const items = addItemIn(snapshot(getItems()), path, emptyFields, atPath);
      if (items) assignItemsToDoc(items);
    };

    const deleteItem = (atPath: string, index: number) => {
      assignItemsToDoc(deleteItemIn(snapshot(getItems()), path, atPath, index));
    };

    const moveItem = (fromPath: string, toPath: string) => {
      assignItemsToDoc(moveItemIn(snapshot(getItems()), path, fromPath, toPath));
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

  /**
   * The block operations, document-wide. Paths are normalized, without `:type`; a list path names
   * the array, `sections` or `sections.0.items`. Every view of the blocks calls these.
   */
  const blocks = {
    list(list: string): GenericBlock[] {
      return readList(doc, list);
    },

    /** The `BlocksBuilder` a list path names, read through the document for the block types. */
    builder(list: string) {
      const field = getFieldAtPath(withBlockTypes(list, doc), documentConfig.fields);
      return field && field.type === 'blocks' ? (field as BlocksBuilder) : undefined;
    },

    /** Whether the list's block set has this type. */
    accepts(list: string, type: string): boolean {
      return !!blocks.builder(list)?.get.blocks.some((block) => block.name === type);
    },

    insert(at: BlockAt, block: NewBlock): string {
      const change = insertBlock(doc, at, block);
      apply(change);
      return change.id;
    },

    remove(path: string): void {
      apply(removeBlock(doc, path));
    },

    duplicate(path: string): string | null {
      const change = duplicateBlockIn(doc, path);
      apply(change);
      return change.id;
    },

    move(from: string, to: BlockAt): void {
      apply(moveBlockIn(doc, from, to));
    },

    /** Copies the block to the clipboard, and keeps it here for a browser that refuses to read back. */
    async copy(path: string): Promise<void> {
      const at = parseBlockPath(path);
      const block = readList(doc, at.list)[at.index];
      if (!block) return;
      const data = toClipboard(block);
      clipboard = data;
      try {
        await navigator.clipboard.writeText(JSON.stringify(data));
      } catch {
        // The in-memory copy above is what paste reads then.
      }
    },

    /** Pastes the copied block at `at`. `null` when there is none, or the list refuses its type. */
    async paste(at: BlockAt): Promise<string | null> {
      let data = clipboard;
      try {
        data = fromClipboard(await navigator.clipboard.readText()) ?? data;
      } catch {
        // Reading the clipboard needs a permission some browsers never give.
      }
      if (!data || !blocks.accepts(at.list, data.type)) return null;
      const { id: _id, path: _path, position: _position, ...block } = withFreshIds(data.block);
      return blocks.insert(at, block as NewBlock);
    }
  };

  let clipboard: ReturnType<typeof toClipboard> | null = null;

  /** Takes a block operation's result: the new document, then each changed list to live edit. */
  function apply(change: { doc: T; lists: string[] }) {
    if (!change.lists.length) return;
    errors.value = rekeyErrors(errors.value, doc, change.doc);
    doc = change.doc;
    if (onDataChange) {
      for (const list of change.lists) {
        onDataChange({ path: list, value: snapshot(getValueAtPath(list, doc)) });
      }
    }
  }

  /** One list's view of the operations above, for the inline cards. */
  function useBlocks(path: string) {
    const list = normalizeFieldPath(path);

    const addBlock: AddBlock = (block) => {
      const { position, ...rest } = block;
      const index = position ?? blocks.list(list).length;
      blocks.insert({ list, index }, rest as NewBlock);
    };

    const deleteBlock = (index: number) => blocks.remove(`${list}.${index}`);

    const moveBlock: MoveBlock = (from, to) => blocks.move(`${list}.${from}`, { list, index: to });

    const duplicateBlock = (index: number) => {
      blocks.duplicate(`${list}.${index}`);
    };

    return {
      addBlock,
      deleteBlock,
      moveBlock,
      duplicateBlock,

      get blocks() {
        return blocks.list(list);
      }
    };
  }

  /** The value at `path` as it is now, a copy that does not follow changes; `null` if falsy. */
  function getRawValue<T>(path: string) {
    return (snapshot(getValueAtPath(path, doc)) as T) || null;
  }

  /** A copy of another locale's value, as new rows in this locale: the save creates them. */
  const asNewRows = <V>(value: V): V => withFreshIds(value, { locale: locale.code });

  /** The document in the default locale, its newest row for a draft; `undefined` when none. */
  const fetchDefaultLocaleDoc = async (): Promise<T | undefined> => {
    const draftParam = doc.status === VERSIONS_STATUS.DRAFT ? `&${PARAMS.LATEST}=true` : '';
    const query = isCollection
      ? `?where[id][equals]=${doc.id}&locale=${locale.defaultCode}${draftParam}`
      : `?locale=${locale.defaultCode}${draftParam}`;
    const result = await fetch(`${apiUrl(documentConfig.kebab)}${query}`).then((r) => r.json());
    if ((isCollection && Array.isArray(result.docs) && result.docs.length) || result.doc) {
      return isCollection ? result.docs[0] : result.doc;
    }
  };

  /**
   * The field at `path`, read and written through the form. `config` is the field's builder;
   * without it, the builder is looked up in the document's fields by `path`.
   */
  function useField<TValue>(path: string, config?: FormFieldBuilder<FormField>) {
    if (!config) {
      const resolved = getFieldAtPath(path, documentConfig.fields);
      if (!resolved) throw new Error(`can't find config for field : ${path}`);
      config = resolved;
    }

    path = path ? normalizeFieldPath(path) : config.name;

    const parts = path.split('.');

    /**
     * Checks `value` and records its error. Answers `true` when it passes, `false` when the field
     * refuses it, and `'required'` for an empty required field, which is still set: the field can
     * be emptied, with its error shown.
     */
    const validate = (value: any) => {
      if (config.get.required && config.use.isEmpty(value)) {
        errors.set(path, 'required::required_field');
        return 'required';
      }

      const validated = config.use.validate(value, {
        data: doc,
        locale: locale.code,
        id: initialDoc.id ?? undefined,
        operation,
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
      const source = await fetchDefaultLocaleDoc();
      if (source) setFieldValue(asNewRows(getValueAtPath<Dic[]>(path, source) || []));
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
      }
    };
  }

  /** The changed top-level keys, as the document holds them now. */
  const changedData = (except: string[] = []) => {
    const data: Dic = {};
    for (const key of Object.keys(changes)) {
      if (!except.includes(key)) data[key] = doc[key];
    }
    return data;
  };

  /** The values, nested as they are, as FormData the server reads with their types. */
  const toFormData = (data: Dic) => {
    // An upload names its folder. The file's name stays on the form for the header to show: the
    // server names the saved file itself.
    if (isCollection && documentConfig.upload) {
      data = {
        ...omit(['filename'], data),
        _path: page.url.searchParams.get(PARAMS.UPLOAD_PATH) || UPLOAD_PATH.ROOT_NAME
      };
    }
    return writeFormData(data);
  };

  /**
   * Prepare the form data for submission.
   * This function collects the changed fields from the document,
   * applies any beforeSubmit hooks, and constructs a FormData object
   * to be sent in the request body.
   */
  const prepareData = async (data: Dic = changedData()) => {
    if (beforeSubmit) {
      data = await beforeSubmit(data);
    }
    return toFormData(data);
  };

  /** A request that got no answer, or an answer that is not an action result. */
  const NO_RESULT: ActionResult<FormSuccessData> = {
    type: 'error',
    error: { status: 0, message: '' }
  };

  /**
   * One POST to a panel action, read back as the action's result. No answer, or a body that is not
   * JSON, reads as an `error` result with no message; a JSON body that is not an action result
   * comes back as it is, with no `type`.
   */
  const send = (action: string, body: FormData): Promise<ActionResult<FormSuccessData>> =>
    fetch(action, { method: 'POST', body })
      .then(async (r) => deserialize<FormSuccessData, Dic>(await r.text()))
      .catch(() => NO_RESULT);

  /** One save at a time. A save that throws still frees the form for the next one. */
  const submit = async (action: string, status?: string) => {
    if (processing) return;
    processing = true;
    try {
      await save(action, status);
    } finally {
      processing = false;
    }
  };

  /**
   * Submit the form data to the server.
   *
   * An auto-save in flight is waited for rather than raced: both write the same row, and the
   * save is the one whose answer replaces the document.
   */
  const save = async (action: string, status?: string) => {
    if (autoSaveInFlight) await autoSaveInFlight;

    const result = await send(action, await prepareData(withStatus(changedData(), status)));

    async function handleSuccess(data?: FormSuccessData) {
      const redirect = data?.redirectUrl || false;
      const message = data?.message || t__('common.generic_success');
      // Invalidate all queries to ensure data consistency across the app
      apiProxy.invalidate(apiUrl(documentConfig.kebab));

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
      // A save ends the auto-save story: the row is a version now, or the changes are in one.
      autoSaveState = 'idle';
      lastAutoSavedAt = null;
      toast.success(message);

      if (nestedLevel !== 0) {
        if (onNestedDocumentCreated) onNestedDocumentCreated(doc);
      }
      if (afterSuccess) afterSuccess(doc);
    }

    async function handleError(data?: Dic) {
      if (data?.errors) {
        errors.value = data.errors;
        for (const [key, error] of Object.entries(errors.value)) {
          toast.error(`${key}: ${errorText(String(error))}`);
        }
      } else {
        toast.error(t__('common.generic_error'));
      }
    }

    switch (result.type) {
      case 'success':
        handleSuccess(result.data);
        break;
      case 'failure':
        handleError(result.data);
        break;
      case 'redirect':
        await applyAction(result);
        break;
      // A `RimeError` out of an action arrives with its status and message, set by the server hook
      // `handleError` (core/errors/handler.server.ts:20).
      case 'error':
        toast.error(result.error?.message || t__('common.generic_error'));
        break;
    }
  };

  /****************************************************/
  /* Auto-save
  /****************************************************/

  let autoSaveState = $state<AutoSaveState>('idle');
  let lastAutoSavedAt = $state<Date | null>(null);
  let autoSaveReason = $state<string | null>(null);
  let autoSaveInFlight: Promise<boolean> | null = null;
  /** What the last failed auto-save carried, so nothing retries until the changes move again. */
  let pausedFor: string | null = null;

  const autoSaveAction = () =>
    `${buildPanelActionUrl()}&${PARAMS.AUTO_SAVE}=true&${PARAMS.VERSION_ID}=${doc.versionId}`;

  /**
   * Fold the row the server wrote back into the form without losing what was typed meanwhile.
   *
   * `sent` is the document as it was when the request left. Whatever differs between `sent` and
   * the document now was typed during the round trip, and goes back on top of the server's row —
   * which brings `versionId`, `isAutoSave`, `updatedAt` and the children's ids.
   */
  const mergeServerDoc = (server: T, sent: T) => {
    const next = mergeTypedSince(server, sent, snapshot(doc) as T);
    initialDoc = server;
    doc = next;
  };

  const failureReason = (result: ActionResult<Dic>): string => {
    const data = result.type === 'failure' ? result.data : undefined;
    if (data?.errors && isObjectLiteral(data.errors)) {
      const [field, error] = Object.entries(data.errors as Dic)[0] ?? [];
      if (field) return `${field}: ${errorText(String(error))}`;
    }
    if (data?.message) return String(data.message);
    return t__('common.generic_error');
  };

  /**
   * Write what has changed into the user's auto-saved row, and answer whether it landed.
   *
   * On success the URL takes the row's `versionId` when it is a new one, with `replaceState`
   * rather than a navigation: a reload would remount the form and drop the focus. On failure
   * the state is `paused` with the reason, and nothing retries until the changes move again.
   */
  const runAutoSave = async (): Promise<boolean> => {
    if (autoSaveInFlight) return autoSaveInFlight;
    if (!autoSavable) return true;

    const sent = snapshot(doc) as T;
    const sentChanges = JSON.stringify(changes);
    autoSaveState = 'saving';

    autoSaveInFlight = (async () => {
      const result = await send(autoSaveAction(), await prepareData(changedData(['status'])));

      if (result.type !== 'success') {
        autoSaveState = 'paused';
        autoSaveReason = failureReason(result as ActionResult<Dic>);
        pausedFor = sentChanges;
        return false;
      }

      const server = result.data?.document as T | undefined;
      if (server) {
        const isNewRow = server.versionId !== sent.versionId;
        mergeServerDoc(server, sent);
        if (isNewRow) {
          // The address follows the row without a load. `replaceState` leaves `page.url` and
          // `page.data` on the row that was loaded: whatever needs the row on screen reads the
          // form, never the URL.
          const params = new SvelteURLSearchParams(page.url.search);
          params.set(PARAMS.VERSION_ID, String(server.versionId));
          replaceState(resolve(`${page.url.pathname}?${params}`), page.state);
        }
      }
      autoSaveState = 'saved';
      lastAutoSavedAt = new Date();
      autoSaveReason = null;
      pausedFor = null;
      // The versions history lists the row now; whoever shows it re-reads.
      apiProxy.invalidate(apiUrl(documentConfig.kebab));
      return true;
    })();

    try {
      return await autoSaveInFlight;
    } finally {
      autoSaveInFlight = null;
    }
  };

  /** Send what is pending now, before leaving. Answers whether it landed. */
  const flushAutoSave = async () => {
    if (!isAutoSave || !autoSavable) return true;
    return runAutoSave();
  };

  /** The same write, handed to the browser to deliver after the tab is gone. */
  const beaconAutoSave = () => {
    if (!isAutoSave || !autoSavable || hasError) return;
    navigator.sendBeacon(autoSaveAction(), toFormData(changedData(['status'])));
  };

  // A quiet moment after the last change, then the write. Every dependency is read up front so
  // the timer resets when any of them moves, and a manual save cancels it through `processing`.
  $effect(() => {
    const armed = isAutoSave && !isDisabled && !hasError && autoSavable && !processing;
    const key = JSON.stringify(changes);
    const paused = autoSaveState === 'paused' && key === pausedFor;
    if (!armed || paused) return;

    const timer = setTimeout(() => void runAutoSave(), AUTO_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  });

  /**
   * The changes, with the status a save asks for when it differs from the form's. The form keeps
   * its own status until the server answers: a refused save leaves it as it was.
   */
  const withStatus = (data: Dic, status: string | undefined) =>
    status && documentConfig.versions?.draft && status !== doc.status ? { ...data, status } : data;

  /**
   * What a plain save does:
   *
   * ```
   * no versions                       save in place
   * versions, no draft                fork: a version per save
   * versions and draft, published     status 'published': the save keeps it published
   * versions and draft, draft         save the draft
   * ```
   */
  const saveIntent = (): { fork: boolean; status?: string } => {
    const versions = documentConfig.versions;
    return {
      fork: !!versions && !versions.draft,
      status: versions && versions.draft && doc.status === 'published' ? 'published' : undefined
    };
  };

  /**
   * Takes over the form's submit: the submitter's `data-fork` and `data-status` say what the save
   * asks for, and a submit with no button (live edit) makes a plain save.
   */
  const enhance = (node: HTMLFormElement) => {
    formElement = node;
    const intentOf = (submitter: SubmitEvent['submitter']) =>
      submitter
        ? { fork: submitter.dataset.fork === 'true', status: submitter.dataset.status }
        : saveIntent();

    // The action names the row on screen, and says `fork` when the save asks for a new version.
    // Not on an auto-saved row: saving that row promotes it into the version the save meant,
    // and forking it would leave what it holds behind.
    const enhanceAction = (fork: boolean) => {
      let actionUrl = buildPanelActionUrl();
      const { FORK, VERSION_ID } = PARAMS;
      if (documentConfig.versions && doc.versionId) actionUrl += `&${VERSION_ID}=${doc.versionId}`;
      if (fork && !doc.isAutoSave) actionUrl += `&${FORK}=true`;
      return actionUrl;
    };

    const listener = async (event: SubmitEvent) => {
      event.preventDefault();
      const { fork, status } = intentOf(event.submitter);
      submit(enhanceAction(fork), status);
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
    const panelUri =
      operation === 'update'
        ? panelUrl(...documentSegments(config.kebab, initial))
        : panelUrl(config.kebab);
    const actionSuffix = operation === 'create' ? '/create?/create' : '?/update';
    const redirectParam = nestedLevel > 0 ? `&${PARAMS.REDIRECT}=false` : '';
    // The locale of the row on screen: a switch elsewhere, in this tab or another, cannot move it
    const localeParam = locale.code ? `&${PARAMS.LOCALE}=${locale.code}` : '';
    return `${panelUri}${actionSuffix}${redirectParam}${localeParam}`;
  };

  /**
   * Import data from the default locale for the current document.
   * This function fetches the document data from the default locale and updates the current document state.
   * It processes localized fields to ensure they are correctly set for the current locale.
   */
  const importDataFromDefaultLocale = async () => {
    const defaultLocaleDoc = await fetchDefaultLocaleDoc();
    if (defaultLocaleDoc) {
      let data = { ...defaultLocaleDoc, locale: locale.code };
      const configMap = buildConfigMap(defaultLocaleDoc, documentConfig.fields);
      for (const [key, field] of Object.entries(configMap)) {
        if (field.get.localized) {
          let value = getValueAtPath<Dic[]>(key, data);
          value = asNewRows(value);
          data = setValueAtPath(key, data, value);
        }
      }
      doc = data;
    }
  };

  return {
    key,
    setValue,
    sync,
    getRawValue,
    enhance,
    useField,
    getValue,
    useBlocks,
    useTree,
    blocks,
    nestedLevel,
    readOnly,
    importDataFromDefaultLocale,
    flushAutoSave,
    beaconAutoSave,

    get isAutoSave() {
      return isAutoSave;
    },

    get autoSaveState() {
      return autoSaveState;
    },

    get lastAutoSavedAt() {
      return lastAutoSavedAt;
    },

    get autoSaveReason() {
      return autoSaveReason;
    },

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

    get saveIntent() {
      return saveIntent();
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

    get config() {
      return config;
    },

    get title() {
      return title;
    },

    get isLive() {
      return isLiveEdit;
    },

    /** Puts the document back as it was loaded or last saved. The errors stay. */
    reset() {
      doc = initialDoc;
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

export type DocumentFormContext<
  T extends WithOptional<GenericDoc, 'id'> = WithOptional<GenericDoc, 'id'>
> = ReturnType<typeof setDocumentFormContext<T>>;

type AddBlock = (block: Omit<GenericBlock, 'id' | 'path'>) => void;
type MoveBlock = (from: number, to: number) => void;
export type FormSuccessData = { redirectUrl?: string; document?: GenericDoc; message?: string };
/** `paused` is a failed auto-save waiting for the changes to move again. */
export type AutoSaveState = 'idle' | 'saving' | 'saved' | 'paused';

type Args<T> = {
  beforeSubmit?: (data: Dic) => Promise<Dic>;
  beforeRedirect?: (data?: FormSuccessData) => Promise<boolean>;
  afterSuccess?: (doc?: T) => void;
  initial: T;
  config: (AreaSlug extends never ? never : BuiltAreaClient) | BuiltCollectionClient;
  readOnly: boolean;
  onDataChange?: any;
  onNestedDocumentCreated?: any;
  key: string;
};
