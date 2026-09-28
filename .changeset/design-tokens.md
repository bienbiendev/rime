---
'rimecms': major
---

Breaking Change: the panel's colors come from a new set of tokens, and the old ones are gone. The grays and the accent are OKLCH colors set by four numbers, `--rz-gray-hue`, `--rz-gray-chroma`, `--rz-accent-hue` and `--rz-accent-chroma`, and `--rz-gray-0` to `--rz-gray-19` are full colors instead of HSL triplets. Components read the scheme's tokens, light and dark both set in `panel/style/scheme.css`: four levels (`--rz-bg-base`, `--rz-bg-page`, `--rz-bg-raised`, `--rz-bg-float`), translucent tints (`--rz-bg-well`, `--rz-bg-hover`, `--rz-bg-active`), `--rz-border`, `--rz-fg`, `--rz-fg-muted`, `--rz-fg-subtle` and the accent (`--rz-accent`, `--rz-accent-text`, `--rz-accent-tint`). CSS written against the old names (`--rz-color-fg`, `--rz-color-bg`, `--rz-color-spot`, `--rz-input-bg`, `--rz-row-bg`, `--rz-border` as a border shorthand, `--rz-shadow-md`, `@mixin ring`) has to move to the new ones.
