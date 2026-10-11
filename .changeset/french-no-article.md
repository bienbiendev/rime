---
'rimecms': patch
---

Fixed: the French panel texts for creating, finding nothing and searching no longer put a masculine article before every collection ("Créer un page"). They now read "Créer : page", "Aucun résultat : page" and "Rechercher : page...". A collection's `label.create`, `label.none` and `label.search` still take precedence.
