---
'rimecms': patch
---

Fixed: `RenderRichText` shows its "[Provide a … component to render this node]" hint for a media, resource or fields node in development only. A built site renders nothing for such a node when `components` has no `media`, `resource` or `fields`.
