---
'rimecms': patch
---

Fixed: `<RenderRichText>` renders a heading whose stored `level` is not 1 to 6 as an `<h2>`. A level such as `"1 x"`, stored through the API, built an invalid tag and the page answered 500.
