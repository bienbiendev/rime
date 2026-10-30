---
'rimecms': patch
---

Fixed: a validator's own message that holds `::`, like `'Format HH::MM'`, shows whole. Only a leading kind such as `required::` or `url::` is dropped, where the message was cut to its part after the last `::`.
