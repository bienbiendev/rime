---
'rimecms': patch
---

Fixed: a `.unique()` field on a versioned collection no longer refuses every new version. A value is shared by a document and its own versions only; the other documents count by their published version (their newest without drafts), and a publish checks every unique value it puts live, sent or not.
