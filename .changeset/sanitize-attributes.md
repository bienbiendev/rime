---
'rimecms': patch
---

Fixed: `string.sanitize` escapes attribute values, so a quote in an `href` can no longer open an event handler. It also drops an `href` whose script scheme hides behind spaces or control characters (`" javascript:"`), and keeps a link's `target` (it kept `_target`).
