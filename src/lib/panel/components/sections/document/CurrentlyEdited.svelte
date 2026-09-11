<script lang="ts">
  import type { User } from '$lib/core/auth/types.js';
  import type { GenericDoc } from '$lib/core/prototype/types.js';
  import { apiUrl } from '$lib/util/index.js';
  import { toKebabCase } from '$lib/util/string.js';
  import { Button } from '../../ui/button/index.js';
  import StaffName from '../../ui/staff-name/StaffName.svelte';
  type Props = { by: string; user: User; doc: GenericDoc };
  const { by, user, doc }: Props = $props();

  /**
   * Claim the document.
   *
   * Both fields, always: `currentlyEditedAt` is what lets the claim expire, so one written without
   * it locks the document for good. `stampLastEditedBy` recognises a write of nothing but these
   * two and stands down, so taking control does not make you the document's last editor.
   */
  async function takeControl() {
    const fetchURl = `${apiUrl(toKebabCase(doc._type))}/${doc._prototype === 'collection' ? doc.id : ''}`;

    await fetch(fetchURl, {
      method: 'PATCH',
      body: JSON.stringify({
        currentlyEditedBy: user.id,
        currentlyEditedAt: new Date()
      })
    });
    window.location.reload();
  }
</script>

<div class="rz-document-read-only">
  <p><StaffName id={by} /> is editing the document</p>
  <Button variant="outline" onclick={takeControl}>Take control</Button>
</div>

<style lang="postcss">
  .rz-document-read-only {
    display: grid;
    gap: 1rem;
    place-content: center;
    position: absolute;
    inset: 0;
    z-index: 100;
    background: hsl(var(--rz-gray-11) / 0.8);
    backdrop-filter: blur(2px);
  }
</style>
