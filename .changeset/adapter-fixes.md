---
'rimecms': patch
---

Fixed: a singleton's bootstrap no longer writes an empty locales row; a `null` element in a relation list is skipped instead of answering 500; a locales branch fetched under `select` carries its locale; an empty string in a required localized column counts as unwritten; `updatedAt` comes from the version row like `updatedBy`.
