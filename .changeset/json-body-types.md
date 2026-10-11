---
'rimecms': minor
---

Breaking Change: a JSON body is taken as it is sent. `"true"`, `"12"` or `"null"` sent as strings stay strings, where they were turned into a boolean, a number or `null`: send `true`, `12` and `null`. A dotted key is no longer expanded: send `{ "meta": { "priority": 4 } }`, not `{ "meta.priority": 4 }`. A form-encoded body written by hand is still read by the shape of each value, dotted keys included.
