<script lang="ts">
	import Button from '$lib/panel/components/ui/button/button.svelte';
	import { getLocaleContext } from '$lib/panel/context/locale.svelte';
	import { getConfigContext } from '$lib/panel/context/config.svelte';
	import Cookies from 'js-cookie';
	import * as DropdownMenu from '$lib/panel/components/ui/dropdown-menu/index.js';
	import { Languages } from '@lucide/svelte';
	import { dev } from '$app/environment';

	type Props = { onLocalClick: (code: string) => void };
	const { onLocalClick }: Props = $props();

	const locale = getLocaleContext();
	const config = getConfigContext();
	const locales = $state(config.raw.localization?.locales || []);
	
	function isActive(code: string) {
		return code === locale.code;
	}
</script>

{#if config.raw.localization?.locales.length}
<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button icon={Languages} size="sm" variant={ props['data-state'] === 'open' ? 'secondary' : 'ghost'} {...props}>
				{locale.label}
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>

	<DropdownMenu.Portal>
		<DropdownMenu.Content align="end">
			{#each locales as item, index (index)}
				<DropdownMenu.Item
					disabled={isActive(item.code)}
					data-active={isActive(item.code) ? '' : null}
					onclick={() => {
						Cookies.set('Locale', item.code, { 
							sameSite: 'strict',
							secure: !dev
						});
						onLocalClick(item.code);
					}}
				>
					<span>{item.label}</span>
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
{/if}