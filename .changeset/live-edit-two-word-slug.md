---
'rimecms': patch
---

Fixed: live edit opens for a collection or area with a two-word slug, such as `blogPosts`. The `update` key of `LiveEdit` is the document's API path without `/api`, with the slug in its URL form: `/blog-posts/123`.
