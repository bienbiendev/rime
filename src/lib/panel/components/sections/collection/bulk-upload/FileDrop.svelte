<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    /** The files dropped or browsed, never none. One unless `multiple`. */
    onfiles: (files: File[]) => void;
    multiple?: boolean;
    /** Mime types the file chooser offers. */
    accept?: string[];
    disabled?: boolean;
    /** What the zone says; `browse` opens the file chooser. */
    children: Snippet<[{ browse: () => void }]>;
  };

  const {
    onfiles,
    multiple = false,
    accept,
    disabled = false,
    children,
    class: className,
    ...rest
  }: Props = $props();

  let input = $state<HTMLInputElement>();
  let over = $state(false);

  /** A drag of files from outside, not of an element of the page. */
  const carriesFiles = (event: DragEvent) => !!event.dataTransfer?.types.includes('Files');

  /** Files over a disabled zone are refused, not opened by the browser. */
  function onDragOver(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    if (disabled && event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    over = !disabled;
  }

  function onDragLeave(event: DragEvent) {
    const zone = event.currentTarget as HTMLElement;
    if (!zone.contains(event.relatedTarget as Node | null)) over = false;
  }

  function onDrop(event: DragEvent) {
    over = false;
    if (!carriesFiles(event)) return;
    event.preventDefault();
    if (!disabled) take(event.dataTransfer?.files);
  }

  function take(list?: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length) onfiles(multiple ? files : files.slice(0, 1));
  }

  const browse = () => input?.click();
</script>

<!-- Takes files dropped on it, or picked from the file chooser. -->
<div
  role="group"
  class="rz-file-drop {className ?? ''}"
  data-over={over ? '' : undefined}
  data-disabled={disabled ? '' : undefined}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
  {...rest}
>
  {@render children({ browse })}
  <input
    bind:this={input}
    type="file"
    hidden
    {multiple}
    {disabled}
    accept={accept?.join(',')}
    onchange={(event) => {
      take(event.currentTarget.files);
      event.currentTarget.value = '';
    }}
  />
</div>

<style lang="postcss">
  @import '../../../../style/mixins/index.css';

  .rz-file-drop {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--rz-size-0-5);
    padding: var(--rz-size-5) var(--rz-size-4);
    border: 1px dashed var(--rz-border-strong);
    border-radius: var(--rz-radius-md);
    background-color: var(--rz-bg-well);
    color: var(--rz-fg-muted);
    text-align: center;
    transition:
      border-color 0.15s,
      background-color 0.15s;
  }

  .rz-file-drop > :global(svg) {
    margin-bottom: var(--rz-size-1-5);
    color: var(--rz-fg-subtle);
  }

  .rz-file-drop :global(small) {
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
  }

  /* The tint lies over the zone's own fill, whatever it is. */
  .rz-file-drop[data-over] {
    border-color: var(--rz-accent-border);
    background-image: linear-gradient(var(--rz-accent-tint) 0 0);
  }

  /* A link-like button inside the zone: "browse", "choose from the library". */
  .rz-file-drop :global(.rz-file-drop__link) {
    color: var(--rz-accent-text);
    &:hover:not(:disabled) {
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    &:focus-visible {
      @mixin focus-ring;
      border-radius: var(--rz-radius-sm);
    }
    &:disabled {
      color: var(--rz-fg-subtle);
      cursor: default;
    }
  }
</style>
