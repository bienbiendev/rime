<!--
  A stored rich text as HTML: paragraphs, headings, lists, quotes, bold, italic, links, breaks and
  rules. `components` replaces an element by its key: `paragraph`, `heading`, `blockquote`,
  `bold`, `italic`, `link`, `ul` (bullet lists), `ol` (ordered lists), `li`, `media` (upload
  nodes), `resource` (resource nodes), `fields` (fields nodes), and any other node or mark type
  by its own name.

  A default element writes no stored attribute, except `href`, `target` and `rel` on a link and
  `start` on an ordered list.

  <RenderRichText json={page.body} components={{ link: SiteLink, fields: Cta }} />
-->
<script lang="ts">
  import { dev } from '$app/env';
  import { isSafeUrl } from '#lib/util/url.js';
  import type { JSONContent } from '@tiptap/core';
  import RenderRichText from './render-rich-text.svelte';
  import type { RichTextNodeRenderer } from './types';

  type Props = {
    json?: JSONContent;
    components?: {
      heading?: RichTextNodeRenderer;
      paragraph?: RichTextNodeRenderer;
      blockquote?: RichTextNodeRenderer;
      bold?: RichTextNodeRenderer;
      italic?: RichTextNodeRenderer;
      link?: RichTextNodeRenderer;
      ul?: RichTextNodeRenderer;
      media?: RichTextNodeRenderer;
      resource?: RichTextNodeRenderer;
      li?: RichTextNodeRenderer;
      ol?: RichTextNodeRenderer;
    } & Record<string, RichTextNodeRenderer>;
  };

  /** The first item of a list and the rest, the list itself unchanged. */
  function shiftAndReturn<T>(arr: T[]): [T | undefined, T[]] {
    const arrayClone = [...arr];
    const item = arrayClone.shift(); // removes and returns the first element
    return [item, arrayClone];
  }

  /** The link target, or no `href` when it would run script. */
  const safeHref = (href: unknown) =>
    typeof href === 'string' && isSafeUrl(href) ? href : undefined;

  const { json, components }: Props = $props();
</script>

{#snippet renderMarks(node: JSONContent[number])}
  {@const marks = [...(node.marks || [])]}
  {@const [mark, processedMarks] = shiftAndReturn(marks)}
  {@const processedNode = { ...node, marks: processedMarks }}

  {#if marks && marks.length}
    {#if mark.type === 'bold'}
      {#if components?.bold}
        <components.bold {components} {node}>
          {@render renderMarks(processedNode)}
        </components.bold>
      {:else}
        <strong>{@render renderMarks(processedNode)}</strong>
      {/if}
      <!--  -->
    {:else if mark.type === 'italic'}
      {#if components?.italic}
        <components.italic {components} {node}>
          {@render renderMarks(processedNode)}
        </components.italic>
      {:else}
        <em>{@render renderMarks(processedNode)}</em>
      {/if}

      <!--  -->
    {:else if mark.type === 'link'}
      {#if components?.link}
        <components.link {components} {node}>
          {@render renderMarks(processedNode)}
        </components.link>
      {:else}
        <a href={safeHref(mark.attrs?.href)} target={mark.attrs?.target} rel={mark.attrs?.rel}
          >{@render renderMarks(processedNode)}</a
        >
      {/if}
    {:else if components && mark.type && mark.type in components}
      {@const CustomMark = components[mark.type]}
      <CustomMark {components} {node}>
        {@render renderMarks(processedNode)}
      </CustomMark>
    {:else}
      <!-- A mark this renderer does not know: its text, without the mark -->
      {@render renderMarks(processedNode)}
    {/if}
  {:else}
    {node.text}
  {/if}
{/snippet}

{#if json?.content}
  {#each json.content as node, index (index)}
    {#if node.type === 'text'}
      {@render renderMarks(node)}
      <!--  -->
    {:else if node.type === 'paragraph'}
      {#if components?.paragraph}
        <components.paragraph {components} {node}>
          <RenderRichText {components} json={node} />
        </components.paragraph>
      {:else}
        <p><RenderRichText {components} json={node} /></p>
      {/if}
      <!--  -->
    {:else if node.type === 'heading'}
      {#if components?.heading}
        <components.heading {components} {node}>
          <RenderRichText {components} json={node} />
        </components.heading>
      {:else}
        {@const level = Number(node.attrs?.level)}
        {@const tag = [1, 2, 3, 4, 5, 6].includes(level) ? `h${level}` : 'h2'}
        <svelte:element this={tag}><RenderRichText {components} json={node} /></svelte:element>
      {/if}
      <!--  -->
    {:else if node.type === 'blockquote'}
      {#if components?.blockquote}
        <components.blockquote {components} {node}>
          <RenderRichText {components} json={node} />
        </components.blockquote>
      {:else}
        <blockquote><RenderRichText {components} json={node} /></blockquote>
      {/if}
      <!--  -->
    {:else if node.type === 'bulletList'}
      {#if components?.ul}
        <components.ul {components} {node}>
          <RenderRichText {components} json={node} />
        </components.ul>
      {:else}
        <ul><RenderRichText {components} json={node} /></ul>
      {/if}
      <!--  -->
    {:else if node.type === 'orderedList'}
      {#if components?.ol}
        <components.ol {components} {node}>
          <RenderRichText {components} json={node} />
        </components.ol>
      {:else}
        <ol start={node.attrs?.start}><RenderRichText {components} json={node} /></ol>
      {/if}
      <!--  -->
    {:else if node.type === 'listItem'}
      {#if components?.li}
        <components.li {components} {node}>
          <RenderRichText {components} json={node} />
        </components.li>
      {:else}
        <li><RenderRichText {components} json={node} /></li>
      {/if}
      <!--  -->
    {:else if node.type?.startsWith('rich-text-upload-')}
      <!-- Without a media component, a node with no url renders nothing: its media is missing, or the reader may not read it -->
      {#if components?.media}
        <components.media {components} {node}>
          <RenderRichText {components} json={node} />
        </components.media>
      {:else if node.attrs?.url && node.attrs.mimeType?.startsWith('image/')}
        <img alt={node.attrs?.alt || ''} style="width:100%;height:auto;" src={node.attrs?.url} />
      {:else if node.attrs?.url && dev}
        [Provide a media component to render this node]
      {/if}
      <!--  -->
    {:else if node.type?.startsWith('rich-text-resource-')}
      <!-- Without a resource component, a node with no _type renders nothing: its document is missing, or the reader may not read it -->
      {#if components?.resource}
        <components.resource {components} {node}>
          <RenderRichText {components} json={node} />
        </components.resource>
      {:else if node.attrs?._type && dev}
        [Provide a resource component to render this node]
      {/if}
    {:else if node.type?.startsWith('rich-text-fields-')}
      {#if components?.fields}
        <components.fields {components} {node}>
          <RenderRichText {components} json={node} />
        </components.fields>
      {:else if dev}
        [Provide a fields component to render this node]
      {/if}
      <!--  -->
    {:else if components && node.type && node.type in components}
      {@const CustomNode = components[node.type]}
      <CustomNode {components} {node}>
        <RenderRichText {components} json={node} />
      </CustomNode>
    {:else if node.type === 'hardBreak'}
      <br />
    {:else if node.type === 'horizontalRule'}
      <hr />
    {:else if node.content}
      <RenderRichText {components} json={node} />
    {/if}
  {/each}
{/if}
