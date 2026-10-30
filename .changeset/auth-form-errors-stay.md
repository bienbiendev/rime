---
'rimecms': patch
---

Fixed: on the sign-in, forgot-password and reset-password pages, a field keeps its error until its own value is valid, and the form keeps what is typed. A change in another field cleared every error and the form posted the last valid value, so an email edited to `a@b` was sent as the previous one; a reset confirmation typed before the password left the button off with no message. A rich-text node's fields pass on valid values only.
