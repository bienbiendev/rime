---
'rimecms': major
---

Breaking Change: a site page imports rime from `rimecms/public`, which never reaches the panel or the config. `openSse`, `createI18n`, `getI18nContext`, `setI18nContext`, `LiveProvider`, `LiveEdit`, `LiveConsumer`, `RenderRichText`, `richTextJSONToText`, `isRelationPopulated`, `isRelationResolved`, `isRelationUnresolved` and `resolveRelation` move there, from `rimecms`, `rimecms/fields/rich-text` and `rimecms/fields/relation`; `rimecms/fields/relation` is gone. `rimecms` keeps what a config and the panel use: `definePlugin`, `i18n` and `t__`; `cache` leaves it. `SignIn`, `ForgotPassword` and `ResetPassword` move from `rimecms/panel` to `rimecms/panel/public`, which the generated sign-in routes import: an anonymous visitor no longer loads the whole panel.
