---
'rimecms': patch
---

Fixed: an image size named with a dash (`large-square`) reaches `doc.sizes.largeSquare`, and its generated type is valid TypeScript. Size names are camelCased once, when the config is built.
