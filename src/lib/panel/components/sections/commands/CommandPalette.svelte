<script lang="ts">
  import { goto } from '$app/navigation';
  import type { ResolvedPathname } from '$app/types';
  import { PARAMS } from '$lib/core/constants.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import { apiUrl, panelPath } from '$lib/core/routes/util.js';
  import * as Command from '$lib/panel/components/ui/command/index.js';
  import {
    getCommandsContext,
    useCommands,
    type Command as CommandType
  } from '$lib/panel/context/commands.svelte.js';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { getUserContext } from '$lib/panel/context/user.svelte.js';
  import type { Route } from '$lib/panel/types.js';
  import { formatKeys, isMac } from '$lib/panel/util/keys.js';
  import type { IconProps } from '@lucide/svelte';
  import { computeCommandScore } from 'bits-ui';
  import type { Component } from 'svelte';

  type Props = { routes?: Record<string, Route[]> };
  const { routes = {} }: Props = $props();

  /** One line of the palette: a command, or a document the search found. */
  type Line = {
    id: string;
    label: string;
    group: string;
    icon?: Component<IconProps>;
    keys?: string;
    run: () => unknown;
  };

  const commands = getCommandsContext()!;
  const config = getConfigContext();
  const user = getUserContext();
  const mac = isMac();

  const pages = $derived(Object.values(routes).flat());

  /** A route's icon is the slug of the collection it opens; the documents search goes there. */
  const collections = $derived(
    pages.flatMap((route) => {
      const collection = config.raw.collections.find((c) => c.slug === route.icon);
      return collection ? [collection] : [];
    })
  );

  const createPath = (collection: (typeof collections)[number]) => {
    const path = panelPath(collection.kebab, 'create');
    return collection.upload ? (`${path}?${PARAMS.UPLOAD_PATH}=root` as ResolvedPathname) : path;
  };

  /**
   * The outermost scope, so its lines come last: ⌘K, then what the panel offers wherever the
   * user is, create a document, go to a collection or an area.
   */
  useCommands(
    () => [
      {
        id: 'palette',
        label: t__('common.commands'),
        keys: 'mod+k',
        inField: true,
        hidden: true,
        run: () => commands.palette.toggle()
      },
      ...collections
        .filter((collection) => collection.access.create(user.attributes, {}))
        .map((collection) => ({
          id: `create.${collection.slug}`,
          label: collection.label.create || t__('common.create_new', collection.label.singular),
          group: t__('common.create'),
          icon: config.raw.icons[collection.slug],
          run: () => goto(createPath(collection))
        })),
      ...pages.map((route) => ({
        id: `go_to.${route.url}`,
        label: route.title,
        group: t__('common.go_to'),
        icon: config.raw.icons[route.icon],
        run: () => goto(route.url as ResolvedPathname)
      }))
    ],
    { depth: 0 }
  );

  const toLine = (command: CommandType): Line => ({
    id: command.id,
    label: command.label,
    group: command.group ?? '',
    icon: command.icon,
    keys: command.keys,
    run: () => command.run()
  });

  const commandLines = $derived(
    commands.palette.commands
      .filter((command) => !commands.palette.group || command.group === commands.palette.group)
      .map(toLine)
  );

  /* ------------------------------------------------------------- search */

  /** What the query names, in the order the lines came: the page's own first. */
  const matching = (lines: Line[], query: string) =>
    query ? lines.filter((line) => computeCommandScore(line.label, query) > 0) : lines;

  /** The documents whose title says the query, five per collection the user can open. */
  async function searchDocuments(query: string): Promise<Line[]> {
    const found = await Promise.all(
      collections.map(async (collection) => {
        const where = `where[${collection.asTitle}][like]=${encodeURIComponent(`%${query}%`)}`;
        const url = `${apiUrl(collection.kebab)}?${where}&select=${collection.asTitle}&limit=5`;
        const response = await fetch(url).catch(() => null);
        if (!response?.ok) return [];
        const { docs } = (await response.json()) as { docs: Record<string, unknown>[] };
        return docs.map((doc) => ({
          id: `${collection.slug}/${doc.id}`,
          label: String(doc[collection.asTitle] ?? doc.id),
          group: collection.label.plural,
          icon: config.raw.icons[collection.slug],
          run: () => goto(panelPath(collection.kebab, String(doc.id)))
        }));
      })
    );
    return found
      .flat()
      .map((line) => ({ line, score: computeCommandScore(line.label, query) }))
      .sort((a, b) => b.score - a.score)
      .map((scored) => scored.line);
  }

  let found = $state.raw<Line[]>([]);

  $effect(() => {
    if (!commands.palette.open) return;
    const query = commands.palette.query.trim();
    found = [];
    if (query.length < 2) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const documents = await searchDocuments(query);
      if (!stale) found = documents;
    }, 200);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  });

  /** The commands the query names, then the documents it found. */
  const lines = $derived([...matching(commandLines, commands.palette.query.trim()), ...found]);

  /** The lines under their heading, in the order the headings first appear. */
  const groups = $derived.by(() => {
    const out: { name: string; lines: Line[] }[] = [];
    for (const line of lines) {
      const group = out.find((candidate) => candidate.name === line.group);
      if (group) group.lines.push(line);
      else out.push({ name: line.group, lines: [line] });
    }
    return out;
  });

  /**
   * The chosen line runs once the dialog has closed and given the focus back to where it was:
   * a command that focuses something, or opens a dialog of its own, comes after that.
   */
  let chosen: Line | null = null;

  function select(line: Line) {
    chosen = line;
    commands.palette.open = false;
  }

  function onCloseAutoFocus() {
    const line = chosen;
    chosen = null;
    if (line) setTimeout(() => line.run(), 0);
  }
</script>

<!--
  One list: what the page offers on top, what the panel offers below, then the documents the
  query found. The order is the scopes', so the list does its own filtering.
-->
<Command.Dialog bind:open={commands.palette.open} shouldFilter={false} {onCloseAutoFocus}>
  <Command.Input placeholder={t__('common.type_a_command')} bind:value={commands.palette.query} />
  <Command.List class="rz-command-palette__list">
    <Command.Empty>{t__('common.nothing_found')}</Command.Empty>
    {#each groups as group (group.name)}
      <Command.Group heading={group.name}>
        {#each group.lines as line (line.id)}
          <Command.Item
            class="rz-command-palette__item"
            value="{line.label} {line.id}"
            onSelect={() => select(line)}
          >
            {#if line.icon}
              {@const Icon = line.icon}
              <span class="rz-command-palette__icon"><Icon size={13} /></span>
            {/if}
            <span class="rz-command-palette__label">{line.label}</span>
            {#if line.keys}
              <kbd>{formatKeys(line.keys, mac)}</kbd>
            {/if}
          </Command.Item>
        {/each}
      </Command.Group>
    {/each}
  </Command.List>
</Command.Dialog>

<style lang="postcss">
  :global(.rz-command-palette__list) {
    max-height: 60vh;
    padding: var(--rz-size-2);
  }

  :global(.rz-command-palette__item) {
    display: flex;
    min-height: var(--rz-size-9);
    align-items: center;
    gap: var(--rz-size-2);
  }

  .rz-command-palette__icon {
    display: flex;
    opacity: 0.7;
  }

  .rz-command-palette__label {
    flex: 1;
  }

  kbd {
    font-size: var(--rz-text-xs);
    color: hsl(var(--rz-color-fg) / 0.5);
  }
</style>
