---
'rimecms': patch
---

Fixed: a block or a tree item sent with an id that is not a string, such as `{ "id": 5, "type": "paragraph" }`, is added as a new row with an id of its own instead of answering 500.
