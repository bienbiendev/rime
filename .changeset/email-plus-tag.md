---
'rimecms': patch
---

Fixed: an email address with a `+` tag or an apostrophe before the `@`, such as `ann+news@x.com` or `o'brien@x.io`, is accepted instead of answering `invalid_email`, and one with two dots in a row before the `@`, such as `a..b@x.io`, is refused.
