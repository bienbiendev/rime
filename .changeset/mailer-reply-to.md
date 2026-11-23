---
'rimecms': patch
---

Added: `rime.mailer.sendMail` takes an optional `replyTo`, the address the recipient's "Reply" answers. The mail still comes from `$smtp.from`.
