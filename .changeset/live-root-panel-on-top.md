---
'rimecms': patch
---

Fixed: a live page whose front also renders a `<LiveConsumer>`, of an area or another document, opens the form of the document it was opened for, and its root button toggles that form, whatever document is read first. The panels the other whole-document `<LiveEdit>`s open as they mount sit under it: closing the page's form shows them.
