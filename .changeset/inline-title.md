---
'rimecms': patch
---

Added: `text('title').isTitle('inline')` makes a collection document's heading the title field. The title is typed in the heading, and the form leaves the field out. A plain `isTitle()` keeps the field in the form, and a title that is not a text field (an email, a file name, an area's label) stays plain text in the heading. In live edit, which has no heading, the field stays in the panel.
