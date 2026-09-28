<!-- A title over two columns of blocks. -->
<svg viewBox="0 0 160 100" fill="currentColor" aria-hidden="true">
  <rect x="20" y="16" width="56" height="7" rx="3.5" opacity="0.55" />
  {#each [20, 84] as x (x)}
    <rect {x} y="32" width="56" height="52" rx="5" opacity="0.14" />
    <rect x={x + 8} y="42" width="40" height="5" rx="2.5" opacity="0.4" />
    <rect x={x + 8} y="53" width="34" height="5" rx="2.5" opacity="0.3" />
    <rect x={x + 8} y="64" width="38" height="5" rx="2.5" opacity="0.3" />
  {/each}
</svg>
