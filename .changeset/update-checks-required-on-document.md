---
'rimecms': minor
---

Breaking Change: an update checks `required` on the whole document it leaves, the values it sends over the stored ones, not on the sent fields alone. A document left incomplete, by a `?skipValidation=true` save for example, refuses every save until its required fields are filled: a save that sends one field answers 400 with `required_field` on the empty ones. To save such a document, send its missing required values along. A field's `validate` reads that whole document too, so it sees the stored value of a field the update did not send.
