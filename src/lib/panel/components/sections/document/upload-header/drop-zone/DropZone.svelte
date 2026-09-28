<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import SpinLoader from '$lib/panel/components/ui/spin-loader/SpinLoader.svelte';
  import { acceptLabel } from '$lib/panel/util/upload-file.js';
  import type { BuiltCollection } from '$lib/types.js';
  import { Upload } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';

  import type { WithUpload } from '$lib/core/prototype/collection/upload/util/config';
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

  /** Leaving the zone, not one of its children. */
  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault();
    const zone = event.currentTarget as HTMLElement;
    if (!zone.contains(event.relatedTarget as Node | null)) dragOver = false;
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
</script>

<!-- A dashed well: an icon, "Drop your file here or browse", the accepted types. -->
<label
  for="file"
  class="rz-doc-upload-dropzone"
  class:rz-doc-upload-dropzone--dragover={dragOver}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  {#if processingFile}
    <SpinLoader />
    <span>{t__('common.generatingPreview')}</span>
  {:else}
    <Upload size={18} />
    <span>
      {t__('common.drop_file')}
      {t__('common.or')}
      <span class="rz-doc-upload-dropzone__browse">{t__('common.browse')}</span>
    </span>
    {#if accept?.length}
      <small>{acceptLabel(accept, t__('common.or'))}</small>
    {/if}
  {/if}

  <input
    class="rz-sr-only"
    disabled={processingFile}
    bind:this={input}
    onchange={handleChange}
    id="file"
    name="file"
    type="file"
  />
</label>

<style type="postcss">
  @import '../../../../../style/mixins/index.css';

  .rz-doc-upload-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--rz-size-0-5);
    min-height: var(--rz-size-40);
    padding: var(--rz-size-8) var(--rz-size-4);
    border: 1px dashed var(--rz-border-strong);
    border-radius: var(--rz-radius-lg);
    background-color: var(--rz-bg-well);
    color: var(--rz-fg-muted);
    text-align: center;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background-color 0.15s;

    > :global(svg) {
      margin-bottom: var(--rz-size-1-5);
      color: var(--rz-fg-subtle);
    }

    small {
      color: var(--rz-fg-subtle);
      font-size: var(--rz-text-sm);
    }

    &:hover .rz-doc-upload-dropzone__browse {
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    /* The file input is hidden but focusable: the zone shows its keyboard focus. */
    &:has(input:focus-visible) {
      @mixin focus-ring;
    }
  }

  .rz-doc-upload-dropzone__browse {
    color: var(--rz-accent-text);
  }

  /* Files over the zone: an accent edge, the tint over the well. */
  .rz-doc-upload-dropzone--dragover {
    border-color: var(--rz-accent-border);
    background-image: linear-gradient(var(--rz-accent-tint) 0 0);
  }
</style>
