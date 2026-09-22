# `--rz-gray-*` usage, by role and by light/dark pair

88 declarations outside `palette.css`: **51** a `light-dark()` pair, **23** a single shade (the same in both schemes), **7** inside a dark block. Measured on `src/`; the script that measures is not in the repository.

The **role** is read off the property the gray lands in — a local token’s name (`--rz-card-bg`) or the CSS property (`border-color`).

## The pairs already in use — light → dark, by role

What a `color-<role>-NN: light-dark(…)` scale has to cover. The same pair in several places is one token.

### background — 39 uses, 22 distinct pairs

| light → dark | alpha | uses | tokens |
|---|---|---|---|
| `16` → `3` |  | 6 | `--rz-button-secondary-bg`, `--rz-group-preview-bg`, `background-color` |
| `16` → `0` |  | 4 | `--rz-nav-bg`, `background-color` |
| `16` → `4` |  | 3 | `--rz-button-ghost-bg-hover`, `--rz-button-outline-bg-hover`, `background-color` |
| `19` → `4` |  | 3 | `--rz-card-hover-bg`, `background-color` |
| `15` → `0` |  | 2 | `--rz-upload-preview-cell-bg`, `background-color` |
| `16` → `5` |  | 2 | `--rz-button-ghost-bg-hover`, `background-color` |
| `16` → `1` |  | 2 | `--rz-folder-hover-bg`, `background-color` |
| `18` → `2` |  | 2 | `--rz-ressource-card-bg`, `background-color` |
| `18` → `3` |  | 2 | `--rz-card-bg`, `background-color` |
| `0` → `15` |  | 1 | `--rz-button-default-bg` |
| `0` → `11` |  | 1 | `--rz-tooltip-color-bg` |
| `2` → `19` |  | 1 | `--rz-button-default-bg-hover` |
| `3` → `12` |  | 1 | `--rz-button-default-bg-disabled` |
| `12` → `3` | 0.8 | 1 | `background` |
| `12` → `3` |  | 1 | `background-color` |
| `15` → `3` |  | 1 | `--rz-ressource-card-thumbnail-bg` |
| `15` → `2` |  | 1 | `--rz-ressource-card-thumbnail-bg` |
| `16` → `3` | 0.6 | 1 | `background-color` |
| `17` → `1` |  | 1 | `--rz-nav-group-bg` |
| `18` → `4` |  | 1 | `--rz-ressource-card-bg` |
| `19` → `3` |  | 1 | `background-color` |
| `19` → `2` |  | 1 | `--rz-nav-button-bg` |

### border — 6 uses, 5 distinct pairs

| light → dark | alpha | uses | tokens |
|---|---|---|---|
| `12` → `6` |  | 2 | `border` |
| `4` → `12` |  | 1 | `--rz-button-outline-fg` |
| `14` → `8` |  | 1 | `--rz-button-outline-border` |
| `14` → `6` | 0.6 | 1 | `--rz-input-border-color` |
| `16` → `2` |  | 1 | `--rz-nav-group-border-color` |

### foreground — 4 uses, 4 distinct pairs

| light → dark | alpha | uses | tokens |
|---|---|---|---|
| `2` → `18` |  | 1 | `color` |
| `13` → `2` |  | 1 | `--rz-button-default-fg` |
| `16` → `2` |  | 1 | `--rz-tooltip-color-fg` |
| `19` → `16` |  | 1 | `--rz-switch-color-thumb` |

### other — 2 uses, 2 distinct pairs

| light → dark | alpha | uses | tokens |
|---|---|---|---|
| `12` → `4` |  | 1 | `--rz-folder-dark` |
| `14` → `6` |  | 1 | `--rz-folder-light` |

## What the pairs suggest

Read off the tables below — the dominant pair per role and level, with what uses it today. A proposal, not a decision.

| token | light → dark | stands in for |
|---|---|---|
| `color-bg-00` | `17` → `2` | the page: `--rz-color-bg`; nav group `17` → `1` |
| `color-bg-10` | `18` → `3` | a surface on the page: `--rz-row-bg`, `--rz-card-bg`, resource cards `18` → `2`/`4` |
| `color-bg-20` | `16` → `4` | raised or hovered: ghost/outline button hover, folder hover `16` → `1`, group preview `16` → `3` (5 uses), nav `16` → `0` |
| `color-bg-30` | `19` → `4` | the topmost: `--rz-input-bg`, `--rz-card-hover-bg`, nav button `19` → `2` |
| `color-bg-inverse` | `0` → `11` | dark on light: tooltip; default button hover `2` → `19`, disabled `3` → `12` |
| `color-border-00` | `16` → `2` | barely there: nav group |
| `color-border-10` | `15` → `4` | the default: `--rz-color-border` |
| `color-border-20` | `14` → `6` | an input, a control: `--rz-input-border-color`, folder `--rz-folder-light` |
| `color-border-30` | `12` → `8` | outlined: `--rz-button-outline-border` `14` → `8`, `border` `12` → `6` |
| `color-fg-00` | `0` → `17` | text: `--rz-color-fg` |
| `color-fg-10` | `4` → `12` | a quieter text: `--rz-button-outline-fg` |
| `color-fg-inverse` | `17` → `0` | text on an inverse surface: tooltip `16` → `2`, default button `13` → `2` |

Muted text is `--rz-color-fg` at an alpha everywhere, never a gray — no `fg-20` in the data. `--rz-overlay-color` (`11`/0.4 → `0`/0.7) and the one `box-shadow` (`6`) are their own thing.

## Single shades — the same gray in both schemes

Each needs a dark counterpart. By role and shade.

### background — 13 uses

| gray | alpha | uses | property | where |
|---|---|---|---|---|
| `0` |  | 1 | `--tag-color-bg` | `panel/components/ui/tag/tag.svelte:25` |
| `3` |  | 1 | `background-color` | `panel/pages/live/Live.svelte:321` |
| `4` |  | 1 | `background-color` | `panel/components/ui/dropdown-menu/dropdown-menu-checkbox-item.svelte:58` |
| `5` |  | 3 | `background-color` | `fields/number/component/number.css:52`, `fields/rich-text/component/bubble-menu/node-selector/node-selector.css:15`, `panel/components/ui/sonner/sonner.css:19` |
| `9` |  | 1 | `background-color` | `fields/number/component/Number.svelte:95` |
| `10` |  | 3 | `--rz-card-color-bg`, `background-color` | `panel/components/sections/collection/grid/grid-item/GridItem.svelte:66`, `panel/pages/collection/CollectionPage.svelte:139`, `panel/pages/collection/CollectionPage.svelte:143` |
| `13` |  | 2 | `--rz-switch-color-bg`, `background-color` | `panel/components/ui/calendar/calendar.css:57`, `panel/components/ui/switch/switch.css:3` |
| `19` |  | 1 | `background-color` | `panel/components/ui/radio-group/radio-group.css:32` |

### border — 2 uses

| gray | alpha | uses | property | where |
|---|---|---|---|---|
| `2` |  | 1 | `--border-color` | `panel/components/ui/radio-group/radio-group.css:26` |
| `10` |  | 1 | `--checkbox-border` | `panel/components/sections/collection/grid/grid-item/GridItem.svelte:65` |

### foreground — 5 uses

| gray | alpha | uses | property | where |
|---|---|---|---|---|
| `2` |  | 1 | `color` | `panel/components/ui/sonner/sonner.css:4` |
| `10` |  | 2 | `color` | `panel/components/sections/collection/Empty.svelte:21`, `panel/components/sections/document/Header.svelte:118` |
| `13` |  | 1 | `--tag-color-fg` | `panel/components/ui/tag/tag.svelte:26` |
| `19` |  | 1 | `--rz-checkbox-fg` | `panel/components/ui/checkbox/checkbox.css:3` |

### shadow — 1 uses

| gray | alpha | uses | property | where |
|---|---|---|---|---|
| `6` | 1 | 1 | `box-shadow` | `panel/style/mixins/index.css:13` |

### other — 2 uses

| gray | alpha | uses | property | where |
|---|---|---|---|---|
| `11` |  | 1 | `--dark` | `panel/components/sections/document/upload-header/UploadHeader.svelte:148` |
| `14` |  | 1 | `--light` | `panel/components/sections/document/upload-header/UploadHeader.svelte:149` |

## The dark block in `index.css`

| token | light | dark |
|---|---|---|
| `--rz-overlay-color` | `?` | `0` |
| `--rz-color-fg` | `?` | `17` |
| `--rz-color-border` | `?` | `4` |
| `--rz-color-bg` | `?` | `2` |
| `--rz-input-bg` | `?` | `4` |
| `--rz-row-bg` | `?` | `3` |
| `--rz-popover-highlight-bg` | `?` | `3` |

## Every use

| role | light | dark | alpha | property | selector | file |
|---|---|---|---|---|---|---|
| background | `0` | `15` |  | `--rz-button-default-bg` | `:root` | `panel/components/ui/button/button.svelte:64` |
| background | `0` |  |  | `--tag-color-bg` | `:root` | `panel/components/ui/tag/tag.svelte:25` |
| background | `0` | `11` |  | `--rz-tooltip-color-bg` | `:root` | `panel/components/ui/tooltip/tooltip-content.svelte:29` |
| background | `2` | `19` |  | `--rz-button-default-bg-hover` | `:root` | `panel/components/ui/button/button.svelte:65` |
| background | `3` | `12` |  | `--rz-button-default-bg-disabled` | `:root` | `panel/components/ui/button/button.svelte:66` |
| background | `3` |  |  | `background-color` | `:global(.rz-live-container__pane-right)` | `panel/pages/live/Live.svelte:321` |
| background | `4` |  |  | `background-color` | `& .rz-dropdown-checkbox[data-highlighted]` | `panel/components/ui/dropdown-menu/dropdown-menu-checkbox-item.svelte:58` |
| background | `5` |  |  | `background-color` | `.rz-number__chevron:hover` | `fields/number/component/number.css:52` |
| background | `5` |  |  | `background-color` | `/* .rz-node-selector__trigger:hover` | `fields/rich-text/component/bubble-menu/node-selector/node-selector.css:15` |
| background | `5` |  |  | `background-color` | `.rz-toaster__cancel` | `panel/components/ui/sonner/sonner.css:19` |
| background | `9` |  |  | `background-color` | `.rz-number-field__chevron:hover` | `fields/number/component/Number.svelte:95` |
| background | `10` |  |  | `--rz-card-color-bg` | `.rz-grid-item` | `panel/components/sections/collection/grid/grid-item/GridItem.svelte:66` |
| background | `10` |  |  | `background-color` | `& :global(.rz-scroll-area--grid)` | `panel/pages/collection/CollectionPage.svelte:139` |
| background | `10` |  |  | `background-color` | `& :global(.rz-scroll-area--nested)` | `panel/pages/collection/CollectionPage.svelte:143` |
| background | `12` | `3` | 0.8 | `background` | `.rz-document-read-only` | `panel/components/sections/document/CurrentlyEdited.svelte:27` |
| background | `12` | `3` |  | `background-color` | `.rz-doc-upload-header__preview` | `panel/components/sections/document/upload-header/UploadHeader.svelte:128` |
| background | `13` |  |  | `background-color` | `.rz-calendar-day:hover` | `panel/components/ui/calendar/calendar.css:57` |
| background | `13` |  |  | `--rz-switch-color-bg` | `:root` | `panel/components/ui/switch/switch.css:3` |
| background | `15` | `3` |  | `--rz-ressource-card-thumbnail-bg` | `.rz-richtext-resource` | `fields/rich-text/core/features/resource/resource.svelte:142` |
| background | `15` | `0` |  | `--rz-upload-preview-cell-bg` | `:root` | `panel/components/sections/collection/upload-thumb-cell/UploadThumbCell.svelte:45` |
| background | `15` | `2` |  | `--rz-ressource-card-thumbnail-bg` | `:root` | `panel/components/ui/card-resource/card-resource.svelte:63` |
| background | `15` | `0` |  | `background-color` | `.rz-user-button__left a` | `panel/components/ui/nav/UserButton.svelte:88` |
| background | `15` |  |  | `--rz-popover-highlight-bg` | `:root` | `panel/style/index.css:38` |
| background | `16` | `3` |  | `--rz-group-preview-bg` | `:root` | `fields/group/component/Group.svelte:94` |
| background | `16` | `5` |  | `background-color` | `.rz-link__target` | `fields/link/component/Link.svelte:258` |
| background | `16` | `3` |  | `background-color` | `.rz-node-selector__node:hover` | `fields/rich-text/component/bubble-menu/node-selector/node-selector.css:45` |
| background | `16` | `3` |  | `background-color` | `.rz-fields-preview__trigger` | `panel/components/fields/FieldsPreviewTrigger.svelte:16` |
| background | `16` | `3` |  | `background-color` | `.rz-no-document` | `panel/components/sections/collection/Empty.svelte:20` |
| background | `16` | `1` |  | `--rz-folder-hover-bg` | `:root` | `panel/components/sections/collection/folder/FolderWithActions.svelte:208` |
| background | `16` | `0` |  | `background-color` | `.rz-checkbox` | `panel/components/sections/collection/grid/grid-item/GridItem.svelte:72` |
| background | `16` | `1` |  | `background-color` | `.rz-list-row__icon` | `panel/components/sections/collection/list/row/Row.svelte:122` |
| background | `16` | `0` |  | `background-color` | `.rz-list-row__checkbox` | `panel/components/sections/collection/list/row/Row.svelte:128` |
| background | `16` | `5` |  | `--rz-button-ghost-bg-hover` | `.rz-dialog-api__key` | `panel/components/sections/document/AuthAPIKeyDialog.svelte:60` |
| background | `16` | `3` |  | `background-color` | `.rz-document-auth` | `panel/components/sections/document/AuthFooter.svelte:85` |
| background | `16` | `4` |  | `background-color` | `&.rz-document-versions__list-item--active` | `panel/components/sections/document/Versions.svelte:155` |
| background | `16` | `4` |  | `--rz-button-outline-bg-hover` | `:root` | `panel/components/ui/button/button.svelte:79` |
| background | `16` | `4` |  | `--rz-button-ghost-bg-hover` | `:root` | `panel/components/ui/button/button.svelte:88` |
| background | `16` | `3` |  | `--rz-button-secondary-bg` | `:root` | `panel/components/ui/button/button.svelte:92` |
| background | `16` | `0` |  | `--rz-nav-bg` | `:root` | `panel/components/ui/nav/Nav.svelte:76` |
| background | `16` | `3` | 0.6 | `background-color` | `.rz-radio-row-group` | `panel/components/ui/radio-row-group/radio-row-group.css:6` |
| background | `16` | `0` |  | `background-color` | `.rz-dashboard__area-icon` | `panel/pages/dashboard/Dashboard.svelte:132` |
| background | `17` | `1` |  | `--rz-nav-group-bg` | `:root` | `panel/components/ui/nav/Nav.svelte:79` |
| background | `17` |  |  | `--rz-color-bg` | `:root` | `panel/style/index.css:29` |
| background | `18` | `2` |  | `--rz-ressource-card-bg` | `.rz-richtext-resource` | `fields/rich-text/core/features/resource/resource.svelte:143` |
| background | `18` | `3` |  | `--rz-card-bg` | `:root` | `panel/components/ui/card-document/card-document.svelte:46` |
| background | `18` | `4` |  | `--rz-ressource-card-bg` | `:root` | `panel/components/ui/card-resource/card-resource.svelte:62` |
| background | `18` | `3` |  | `background-color` | `.rz-dashboard__area` | `panel/pages/dashboard/Dashboard.svelte:103` |
| background | `18` | `2` |  | `background-color` | `.rz-live-container__overlay` | `panel/pages/live/Live.svelte:359` |
| background | `18` |  |  | `--rz-row-bg` | `:root` | `panel/style/index.css:25` |
| background | `19` | `4` |  | `background-color` | `.rz-auto-save-banners` | `panel/components/sections/document/AutoSaveBanner.svelte:97` |
| background | `19` | `3` |  | `background-color` | `.rz-document-versions__list-item` | `panel/components/sections/document/Versions.svelte:152` |
| background | `19` | `4` |  | `--rz-card-hover-bg` | `:root` | `panel/components/ui/card-document/card-document.svelte:45` |
| background | `19` | `2` |  | `--rz-nav-button-bg` | `:root` | `panel/components/ui/nav/Nav.svelte:78` |
| background | `19` |  |  | `background-color` | `.rz-radio-group-item[data-state='checked']` | `panel/components/ui/radio-group/radio-group.css:32` |
| background | `19` | `4` |  | `background-color` | `&:hover` | `panel/pages/dashboard/Dashboard.svelte:115` |
| background | `19` |  |  | `--rz-input-bg` | `:root` | `panel/style/index.css:17` |
| background |  | `2` |  | `--rz-color-bg` | `@media (prefers-color-scheme: dark)` | `panel/style/index.css:44` |
| background |  | `4` |  | `--rz-input-bg` | `@media (prefers-color-scheme: dark)` | `panel/style/index.css:45` |
| background |  | `3` |  | `--rz-row-bg` | `@media (prefers-color-scheme: dark)` | `panel/style/index.css:46` |
| background |  | `3` |  | `--rz-popover-highlight-bg` | `@media (prefers-color-scheme: dark)` | `panel/style/index.css:47` |
| border | `2` |  |  | `--border-color` | `.rz-radio-group-item:hover` | `panel/components/ui/radio-group/radio-group.css:26` |
| border | `4` | `12` |  | `--rz-button-outline-fg` | `:root` | `panel/components/ui/button/button.svelte:77` |
| border | `10` |  |  | `--checkbox-border` | `.rz-grid-item` | `panel/components/sections/collection/grid/grid-item/GridItem.svelte:65` |
| border | `12` | `6` |  | `border` | `.rz-bulk-dropzone` | `panel/components/sections/collection/bulk-upload/DropZone.svelte:137` |
| border | `12` | `6` |  | `border` | `.rz-doc-upload-dropzone` | `panel/components/sections/document/upload-header/drop-zone/DropZone.svelte:119` |
| border | `14` | `8` |  | `--rz-button-outline-border` | `:root` | `panel/components/ui/button/button.svelte:78` |
| border | `14` | `6` | 0.6 | `--rz-input-border-color` | `:root` | `panel/components/ui/input/input.svelte:32` |
| border | `15` |  |  | `--rz-color-border` | `:root` | `panel/style/index.css:30` |
| border | `16` | `2` |  | `--rz-nav-group-border-color` | `:root` | `panel/components/ui/nav/Nav.svelte:80` |
| border |  | `4` |  | `--rz-color-border` | `@media (prefers-color-scheme: dark)` | `panel/style/index.css:43` |
| foreground | `0` |  |  | `--rz-color-fg` | `:root` | `panel/style/index.css:28` |
| foreground | `2` |  |  | `color` | `.rz-toaster__toast[data-sonner-toast][data-sonner-…` | `panel/components/ui/sonner/sonner.css:4` |
| foreground | `2` | `18` |  | `color` | `.rz-live-container__overlay` | `panel/pages/live/Live.svelte:360` |
| foreground | `10` |  |  | `color` | `.rz-no-document` | `panel/components/sections/collection/Empty.svelte:21` |
| foreground | `10` |  |  | `color` | `.rz-auto-save-state` | `panel/components/sections/document/Header.svelte:118` |
| foreground | `11` |  |  | `--rz-overlay-color` | `:root` | `panel/style/index.css:20` |
| foreground | `13` | `2` |  | `--rz-button-default-fg` | `:root` | `panel/components/ui/button/button.svelte:67` |
| foreground | `13` |  |  | `--tag-color-fg` | `:root` | `panel/components/ui/tag/tag.svelte:26` |
| foreground | `16` | `2` |  | `--rz-tooltip-color-fg` | `:root` | `panel/components/ui/tooltip/tooltip-content.svelte:28` |
| foreground | `19` |  |  | `--rz-checkbox-fg` | `:root` | `panel/components/ui/checkbox/checkbox.css:3` |
| foreground | `19` | `16` |  | `--rz-switch-color-thumb` | `:root` | `panel/components/ui/switch/switch.css:2` |
| foreground |  | `0` |  | `--rz-overlay-color` | `@media (prefers-color-scheme: dark)` | `panel/style/index.css:41` |
| foreground |  | `17` |  | `--rz-color-fg` | `@media (prefers-color-scheme: dark)` | `panel/style/index.css:42` |
| shadow | `6` |  | 1 | `box-shadow` | `@define-mixin ring $color, $size: 1px` | `panel/style/mixins/index.css:13` |
| other | `11` |  |  | `--dark` | `.rz-doc-upload-header__prewiew-grid` | `panel/components/sections/document/upload-header/UploadHeader.svelte:148` |
| other | `12` | `4` |  | `--rz-folder-dark` | `:root` | `panel/components/sections/collection/folder/Folder.svelte:37` |
| other | `14` | `6` |  | `--rz-folder-light` | `:root` | `panel/components/sections/collection/folder/Folder.svelte:36` |
| other | `14` |  |  | `--light` | `.rz-doc-upload-header__prewiew-grid` | `panel/components/sections/document/upload-header/UploadHeader.svelte:149` |
