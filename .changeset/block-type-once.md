---
'rimecms': patch
---

Fixed: a generated block type has `type` once, the block's name: `type: 'card'`, where a second `type?: string` used to win. A list of blocks narrows on `block.type`, and a block is a `GenericBlock`.
