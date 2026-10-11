---
'rimecms': patch
---

Fixed: an API form error reads each field's error as the panel shows it. A composite code read `errors.url::invalid_url`, and a custom validator's message was prefixed with `errors.`.
