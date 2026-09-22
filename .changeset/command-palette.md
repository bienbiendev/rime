---
'rimecms': minor
---

Added: a command palette for the panel. ⌘K lists what the page offers, innermost first, under headings: the editor's marks and nodes when a rich text has the focus, the blocks of focus mode (add a type, duplicate, move, copy, paste, remove, go to a row), the document (save, versions history, save in a new draft, duplicate, delete, mark as published or draft), the collection list (new document, search, new folder and bulk upload, show as a list, a grid, a tree). ⌘⇧K is the whole panel: create a document in any collection, go to a collection or an area, and a search over the documents by their title. Every key of the panel goes through the same dispatcher: a component offers its commands with `useCommands` from `rimecms/panel`, and the innermost one that claims a key gets it.
