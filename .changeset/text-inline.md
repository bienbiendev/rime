---
'rimecms': minor
---

Added: `TextInline` from `rimecms/panel`, a `text` or `textarea` field edited where a block render draws it: the render's own element, `<TextInline as="h2" path="{path}.title" config={title} {form} />`, keeps its tag and its class. A text is one line, a textarea keeps its lines.
