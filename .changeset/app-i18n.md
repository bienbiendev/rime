---
'rimecms': minor
---

Added: `createI18n(dictionaries)` from `rimecms` is the panel's translator over an app's own dictionaries, sharing nothing with the panel's: `$1` parameters, `|m`, `|f`, `|p` variants, a key it has nothing for returned as is. Given a function it reads the dictionaries on every call, so a translator over a layout's `data` follows a locale switch. `setI18nContext` and `getI18nContext` pass one down a Svelte tree. The `i18n` and `t__` exports stay the panel's own; on the server one instance serves every request, so an app's texts belong in `createI18n`.
