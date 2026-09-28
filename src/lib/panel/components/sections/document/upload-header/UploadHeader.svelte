<script lang="ts">
  import type { BuiltCollection } from '$lib/core/config/types.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import type { WithUpload } from '$lib/core/prototype/collection/upload/util/config.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import { type DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { mimeTypeToIcon } from '$lib/panel/util/upload.js';
  import * as util from '$lib/util/file.js';
  import { fileSizeLabel } from '$lib/panel/util/upload-file.js';
  import { toast } from 'svelte-sonner';
  import DropZone from './drop-zone/DropZone.svelte';

  type Props = {
    form: DocumentFormContext;
    create: boolean;
    accept: WithUpload<BuiltCollection>['upload']['accept'];
  };
  const { form, create, accept }: Props = $props();

  let preview = $state<string | null>(null);
  let file = $state<File | null>(null);
  let isValidFile = $state(false);

  const hasAccept = $derived('accept' in form.config);
  const allowedMimeTypes = $derived(accept || []);

  const deleteFile = () => {
    preview = null;
    file = null;
    form.setValue('url', null);
    form.setValue('file', null);
    form.setValue('filename', null);
    form.setValue('mimeType', null);
    form.setValue('filesize', null);
    form.errors.delete('mimeType');
    form.setValue(`_thumbnail`, null);
  };

  /** The file's facts, each with its name. */
  const facts = $derived([
    { key: 'filename', label: t__('fields.file_name') },
    { key: 'filesize', label: t__('fields.file_size') },
    { key: 'mimeType', label: t__('fields.file_type') }
  ]);

  const onGeneratingPreviewStart = () => (form.isDisabled = true);
  const onGeneratingPreviewEnd = () => (form.isDisabled = false);

  $effect(() => {
    if (file) {
      const validMimeType =
        !hasAccept || (allowedMimeTypes.length && allowedMimeTypes.includes(file.type));
      if (!validMimeType) {
        const error = `File should be type of ${allowedMimeTypes.join(' | ')}, received ${file.type}`;
        form.errors.set('mimeType', error);
        toast.error(error);
        isValidFile = false;
        file = null;
      } else {
        form.errors.delete('mimeType');
        isValidFile = true;
      }
    }
  });

  $effect(() => {
    if (file && isValidFile && form.values.filename !== file.name) {
      form.setValue('filename', file.name);
      form.setValue('filesize', util.fileSizeToString(file.size));
      form.setValue('mimeType', file.type);
      form.setValue('file', file);
    }
  });
</script>

<!-- The file: a preview beside its name, size and type; before one is picked, a drop zone. -->
<div class="rz-doc-upload-header">
  {#if form.values.mimeType}
    <div class="rz-doc-upload-header__file">
      <div class="rz-doc-upload-header__preview">
        {#if form.values.mimeType.includes('image')}
          <div class="rz-doc-upload-header__prewiew-grid">
            {#key form.values.title}
              <img src={form.values.url || form.values._thumbnail || preview} alt="preview" />
            {/key}
          </div>
        {:else}
          {@const FileIcon = mimeTypeToIcon(form.values.mimeType)}
          <div class="rz-doc-upload-header__prewiew-file">
            <FileIcon size="32" />
            <span>{form.values.mimeType}</span>
          </div>
        {/if}
      </div>
      <div class="rz-doc-upload-header__info">
        {#each facts as { key, label } (key)}
          <div class="rz-doc-upload-header__fact">
            <span class="rz-doc-upload-header__label">{label}</span>
            {#if !create && key === 'filename'}
              <a target="_blank" rel="external" href="/medias/{form.values[key]}">
                {form.values[key]}
              </a>
            {:else if key === 'filesize'}
              <p>{fileSizeLabel(form.values[key])}</p>
            {:else}
              <p>{form.values[key]}</p>
            {/if}
          </div>
        {/each}
        <div class="rz-doc-upload-header__actions">
          <Button onclick={deleteFile} size="sm" variant="secondary">{t__('fields.remove')}</Button>
        </div>
      </div>
    </div>
  {:else}
    <DropZone bind:preview bind:file {onGeneratingPreviewStart} {onGeneratingPreviewEnd} {accept} />
  {/if}
</div>

<style type="postcss">
  @import '../../../../style/mixins/index.css';

  .rz-doc-upload-header {
    container: inline-size;
    padding: 0 var(--rz-fields-padding);
  }

  /* A card: the preview on a well, then the facts; side by side when there is room. */
  .rz-doc-upload-header__file {
    @mixin surface raised;
    overflow: hidden;
    border-radius: var(--rz-radius-xl);
  }

  .rz-doc-upload-header__preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: var(--rz-size-48);
    max-height: 400px;
    overflow: hidden;
    background-color: var(--rz-bg-well);
  }

  @container (min-width: 28rem) {
    .rz-doc-upload-header__file {
      display: flex;
    }
    .rz-doc-upload-header__preview {
      width: clamp(var(--rz-size-60), 50%, var(--rz-size-80));
      flex-shrink: 0;
    }
  }

  /* A checkerboard under the image, so a transparent one shows its edges. */
  .rz-doc-upload-header__prewiew-grid {
    width: 100%;
    height: 100%;
    --dark: var(--rz-bg-active);
    --light: var(--rz-bg-well);
    --size: 16px;
    --half-size: calc(var(--size) / 2);
    background-size: var(--size) var(--size);
    background-image:
      linear-gradient(
        45deg,
        var(--dark) 25%,
        transparent 25%,
        transparent 75%,
        var(--dark) 75%,
        var(--dark)
      ),
      linear-gradient(
        45deg,
        var(--dark) 25%,
        transparent 25%,
        transparent 75%,
        var(--dark) 75%,
        var(--dark)
      ),
      linear-gradient(
        45deg,
        var(--light) 25%,
        transparent 25%,
        transparent 75%,
        var(--light) 75%,
        var(--light)
      ),
      linear-gradient(
        45deg,
        var(--light) 25%,
        transparent 25%,
        transparent 75%,
        var(--light) 75%,
        var(--light)
      );
    background-position:
      0 0,
      var(--half-size) var(--half-size),
      var(--half-size) 0,
      0 var(--half-size);
  }

  .rz-doc-upload-header__prewiew-grid img {
    height: 100%;
    width: 100%;
    object-fit: contain;
  }

  .rz-doc-upload-header__prewiew-file {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--rz-size-2);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
  }

  /* The facts: a quiet list, the names subtle, the values plain, hairlines between. */
  .rz-doc-upload-header__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: var(--rz-size-1) var(--rz-size-3-5) var(--rz-size-3-5);
  }

  .rz-doc-upload-header__fact {
    display: grid;
    gap: var(--rz-size-0-5);
    padding-block: var(--rz-size-2-5);
  }

  .rz-doc-upload-header__fact + .rz-doc-upload-header__fact {
    box-shadow: inset 0 1px 0 var(--rz-border);
  }

  .rz-doc-upload-header__label {
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
  }

  .rz-doc-upload-header__fact :is(p, a) {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .rz-doc-upload-header__fact a {
    color: var(--rz-accent-text);
    border-radius: var(--rz-radius-sm);

    &:hover {
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-doc-upload-header__actions {
    margin-top: auto;
    padding-top: var(--rz-size-3);
  }
</style>
