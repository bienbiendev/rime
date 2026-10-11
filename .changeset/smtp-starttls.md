---
'rimecms': patch
---

Fixed: the mailer opens TLS at once on port 465 only, so an SMTP server on 587 or 25 works through STARTTLS. `$smtp.secure` sets it for any other port. A failed mail still answers "Error while sending mail", and the server log now shows the transport's error, which the `mail_error` carries as its `cause`.
