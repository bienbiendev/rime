<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import SpinLoader from '$lib/panel/components/ui/spin-loader/SpinLoader.svelte';
  import type { BuiltCollection } from '$lib/types.js';
  import { toast } from 'svelte-sonner';

  import type { WithUpload } from '$lib/core/collections/upload/util/config';
  import type { ChangeEventHandler } from 'svelte/elements';

  type Props = {
    accept: WithUpload<BuiltCollection>['upload']['accept'] | undefined;
    preview: string | null;
    file: File | null;
    onGeneratingPreviewStart: () => void;
    onGeneratingPreviewEnd: () => void;
  };

  let {
    preview = $bindable(),
    file = $bindable(),
    accept,
    onGeneratingPreviewStart,
    onGeneratingPreviewEnd
  }: Props = $props();

  let input: HTMLInputElement;
  let dragOver = $state(false);
  let processingFile = $state(false);

  const handleDragOver = (event: DragEvent) => {
    dragOver = true;
    event.preventDefault();
  };

  const handleDragLeave = (event: DragEvent) => {
    dragOver = false;
    event.preventDefault();
  };

  const handleChange: ChangeEventHandler<HTMLInputElement> = () => {
    const files = input.files;
    if (files && files.length) {
      processFile(files[0]);
    }
  };

  const handleDrop = (event: DragEvent) => {
    dragOver = false;
    event.preventDefault();

    if ('dataTransfer' in event && event.dataTransfer && event.dataTransfer.files) {
      const droppedFiles = Array.from(event.dataTransfer.files);
      processFile(droppedFiles[0]);
    }
  };

  const processFile = (value: File) => {
    processingFile = true;
    onGeneratingPreviewStart();
    const reader = new FileReader();

    reader.onloadend = () => {
      preview = typeof reader.result === 'string' ? reader.result : null;
      file = value;
      processingFile = false;
      onGeneratingPreviewEnd();
    };

    reader.onerror = (err) => {
      processingFile = false;
      onGeneratingPreviewEnd();
      toast.error('There was an issue reading the file.');
      console.error(err);
    };

    reader.readAsDataURL(value);
  };

  const dragOverClassModifier = $derived(dragOver ? 'rz-doc-upload-dropzone--dragover' : '');
</script>

<label
  for="file"
  class="rz-doc-upload-dropzone {dragOverClassModifier}"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  {#if processingFile}
    <div class="rz-doc-upload-dropzone__processing">
      <SpinLoader />
      <p>{t__('common.generatingPreview')}</p>
    </div>
  {:else}
    <p>{t__('common.drop_file')} {t__('common.or')} <strong>{t__('common.browse')}</strong></p>
    {#if accept}
      <p class="rz-doc-upload-dropzone__accept">{accept.join(', ')} accepted</p>
    {/if}
  {/if}

  <input
    disabled={processingFile}
    bind:this={input}
    onchange={handleChange}
    id="file"
    name="file"
    type="file"
    placeholder="upload"
  />
</label>

<style type="postcss">
  .rz-doc-upload-dropzone {
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

  .rz-doc-upload-dropzone__processing {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
  }

  .rz-doc-upload-dropzone:focus-visible {
    outline: none;
    --ring-offset: 1px;
    @mixin ring var(--rz-color-ring);
  }

  .rz-doc-upload-dropzone--dragover {
    border-color: hsl(var(--rz-color-ring) / 1);
  }

  .rz-doc-upload-dropzone input {
    display: none;
  }
  .rz-doc-upload-dropzone__accept {
    opacity: 0.5;
    font-size: var(--rz-text-xs);
  }
</style>
