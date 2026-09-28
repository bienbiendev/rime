<!-- Three pictures side by side. -->
<svg viewBox="0 0 160 100" fill="currentColor" aria-hidden="true">
  {#each [18, 60, 102] as x (x)}
    <rect {x} y="29" width="40" height="42" rx="4" opacity="0.2" />
    <path d="M{x + 6} 65 {x + 18} 51 {x + 26} 58 {x + 34} 65Z" opacity="0.5" />
  {/each}
</svg>
