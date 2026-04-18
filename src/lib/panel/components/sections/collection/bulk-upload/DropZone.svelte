<script lang="ts">
  import { PARAMS } from '$lib/core/constant';
  import { t__ } from '$lib/core/i18n/index.js';
  import SpinLoader from '$lib/panel/components/ui/spin-loader/SpinLoader.svelte';
  import type { CollectionContext } from '$lib/panel/context/collection.svelte';
  import { trycatch, trycatchFetch } from '$lib/util/function.js';

  type Props = {
    collection: CollectionContext;
    onStart: () => void;
    onFinish: (hasError: boolean) => void;
  };

  let { collection, onFinish, onStart }: Props = $props();

  let input = $state<HTMLInputElement>();
  let dragOver = $state(false);
  let processingFile = $state(false);
  let files = $state<File[]>([]);
  let currentlyProcessing = $state('');
  let processed = $state(0);
  let errors = $state<string[]>([]);

  const handleDragOver = (event: DragEvent) => {
    dragOver = true;
    event.preventDefault();
  };

  const handleDragLeave = (event: DragEvent) => {
    dragOver = false;
    event.preventDefault();
  };

  const handleDrop = (event: DragEvent) => {
    dragOver = false;
    event.preventDefault();

    if ('dataTransfer' in event && event.dataTransfer && event.dataTransfer.files) {
      files = Array.from(event.dataTransfer.files);
      processFiles(files);
    }
  };

  async function processFiles(files: File[]) {
    onStart();
    for (const file of files) {
      currentlyProcessing = file.name;
      const [conversionError, base64] = await trycatch(getBase64(file));

      if (conversionError) {
        errors.push(file.name);
        continue;
      }

      const createUploadURL = `${collection.apiUrl}?${PARAMS.SKIP_VALIDATION}=true`;
      const [error, success] = await trycatchFetch(createUploadURL, {
        method: 'POST',
        body: JSON.stringify({
          _path: collection.upload.currentPath,
          file: {
            base64,
            filename: file.name
          }
        })
      });
      if (error) {
        errors.push(file.name);
      } else if (success) {
        processed++;
      }
    }

    onFinish(!!errors.length);
  }

  async function getBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to read file as string'));
        }
      };
      reader.readAsDataURL(file);
    });
  }

  const dragOverClassModifier = $derived(dragOver ? 'rz-bulk-dropzone--dragover' : '');
</script>

{#if files.length}
  <div class="rz-bulk-infos">
    <div class="rz-bulk-infos__current"><SpinLoader />{currentlyProcessing}</div>
    <div class="rz-bulk-infos__processed">
      {processed} / {files.length} created<br />
    </div>
    {#if errors.length}
      <div class="rz-bulk-infos__errors">
        {errors.length} errors.
      </div>
    {/if}
  </div>
{:else}
  <label
    for="file"
    class="rz-bulk-dropzone {dragOverClassModifier}"
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
  >
    <p>{t__('common.drop_files')} {t__('common.or')} <strong>{t__('common.browse')}</strong></p>
    {#if collection.config.upload?.accept}
      <p class="rz-bulk-dropzone__accept">{collection.config.upload.accept.join(', ')} accepted</p>
    {/if}

    <input
      disabled={processingFile}
      bind:this={input}
      id="file"
      name="file"
      type="file"
      placeholder="upload"
    />
  </label>
{/if}

<style type="postcss">
  .rz-bulk-dropzone {
    display: grid;
    cursor: pointer;
    height: var(--rz-size-32);
    place-content: center;
    border-radius: var(--rz-radius-lg);
    border: 2px dashed light-dark(hsl(var(--rz-gray-12)), hsl(var(--rz-gray-6)));
    background: transparent;
    text-align: center;
    font-size: var(--rz-text-sm);
  }

  .rz-bulk-dropzone__processing {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
  }

  .rz-bulk-dropzone:focus-visible {
    outline: none;
    --ring-offset: 1px;
    @mixin ring var(--rz-color-ring);
  }

  .rz-bulk-dropzone--dragover {
    border-color: hsl(var(--rz-color-ring) / 1);
  }

  .rz-bulk-dropzone input {
    display: none;
  }

  .rz-bulk-dropzone__accept {
    opacity: 0.5;
    font-size: var(--rz-text-xs);
  }

  .rz-bulk-infos__current {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    margin-bottom: var(--rz-size-2);
  }

  .rz-bulk-infos__errors {
    color: hsl(var(--rz-color-error));
  }

  .rz-bulk-infos__processed {
    @mixin font-medium;
  }
</style>
