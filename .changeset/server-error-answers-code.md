---
'rimecms': patch
---

Fixed: a 5xx `RimeError` answers its code only, `upload_error` say, and the server logs its message with the stack. Its message, which can hold a server path, no longer reaches the client. A 4xx keeps its message.
