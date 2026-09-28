<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import {
    acceptLabel,
    uploadFiles,
    type UploadProgress as Progress,
    type UploadTarget
  } from '$lib/panel/util/upload-file.js';
  import { Upload } from '@lucide/svelte';
  import FileDrop from './FileDrop.svelte';
  import UploadProgress from './UploadProgress.svelte';

  type Props = {
    /** Where the files go: the collection's API, the folder, the types it takes. */
    target: UploadTarget;
    onStart: () => void;
    onFinish: (hasError: boolean) => void;
  };

  let { target, onFinish, onStart }: Props = $props();

  let progress = $state<Progress | null>(null);

  // JPG, PNG or WEBP
  const accepted = $derived(
    target.accept?.length ? acceptLabel(target.accept, t__('common.or')) : ''
  );

  /** Each file becomes a document in the target's folder. */
  async function upload(files: File[]) {
    onStart();
    const { failed } = await uploadFiles(files, target, (state) => (progress = state));
    onFinish(failed.length > 0);
  }
</script>

{#if progress}
  <UploadProgress {progress} class="rz-bulk-progress" />
{:else}
  <FileDrop class="rz-bulk-dropzone" multiple accept={target.accept} onfiles={upload}>
    {#snippet children({ browse })}
      <Upload size={18} />
      <span>
        {t__('common.drop_files')}
        {t__('common.or')}
        <button type="button" class="rz-file-drop__link" onclick={browse}>
          {t__('common.browse')}
        </button>
      </span>
      {#if accepted}
        <small class="rz-bulk-dropzone__accept">{accepted}</small>
      {/if}
    {/snippet}
  </FileDrop>
{/if}

<style lang="postcss">
  :global(.rz-bulk-dropzone) {
    min-height: var(--rz-size-40);
  }

  :global(.rz-bulk-infos.rz-bulk-progress) {
    min-height: var(--rz-size-40);
    padding: var(--rz-size-5) var(--rz-size-4);
    border-radius: var(--rz-radius-md);
    background-color: var(--rz-bg-well);
  }
</style>
