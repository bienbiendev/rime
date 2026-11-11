---
'rimecms': minor
---

Breaking Change: `rimecms/core/plugins/cache/module` no longer exports `toHash`. A project that used it hashes with Node's crypto: `createHash('sha256').update(text).digest('hex')`.
