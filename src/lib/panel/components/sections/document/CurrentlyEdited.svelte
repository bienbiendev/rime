<script lang="ts">
  import { apiUrl } from '$lib/core/api/index.js';
  import type { User } from '$lib/core/collections/auth/types.js';
  import type { GenericDoc } from '$lib/core/types/doc.js';
  import { toKebabCase } from '$lib/util/string.js';
  import { onMount } from 'svelte';
  import { Button } from '../../ui/button/index.js';
  type Props = { by: string; user: User; doc: GenericDoc };
  const { by, user, doc }: Props = $props();

  async function takeControl() {
    const fetchURl = `${apiUrl(toKebabCase(doc._type))}/${doc._prototype === 'collection' ? doc.id : ''}`;

    await fetch(fetchURl, {
      method: 'PATCH',
      body: JSON.stringify({
        editedBy: user.id
      })
    });
    window.location.reload();
  }

  let email = $state();

  onMount(async () => {
    const { doc } = await fetch(apiUrl('staff', by)).then((r) => r.json());
    email = doc.email;
  });
</script>

<div class="rz-document-read-only">
  <p><strong>{email}</strong> is editing the document</p>
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
