---
'rimecms': patch
---

Fixed: the upload picker of a relation field marks what is picked, with its position for a many field and a check for a one field. A click on a picked image takes it out instead of throwing. A one field closes on a pick, which replaces the one before; a many field stays open, counts the picks in a footer and closes on _Done_. A press dragged across the images picks them all, or takes them all out when it starts on a picked one, and shift-click picks the range from the last pick. A button in its header creates a document without leaving the picker, and the new one is picked; with nothing uploaded yet, the grid says so and offers to create the first one.
