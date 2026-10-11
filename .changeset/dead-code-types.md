---
'rimecms': minor
---

Breaking Change: members that rime never sets or reads are removed from the published types: `$InferRoutes`, `$InferAreasSlug` and `$InferCollectionsSlug` on `BuildConfig`; `$database` on `BuiltConfig`; `getDocumentPrototype` on the config context; `unique` on `ComboBoxField`, `DateField` and `TimeField`; `layout` on `RelationField`; `tree` on `BlocksField`; `suggestionOpen` and `editor` on the rich-text context; `context` in the `SvelteNodeViewRenderer` options; `invalidateAll` and `urls` on the API proxy context; the unused getters of the collection, document form and errors contexts; the `status: 401` arm of `CollectionDocData` and `AreaDocData`; `lastEdited` and `titleSingular` in the dashboard entries; the `TranslationKey` and `ModifiedKey` types; and the panel translation keys nothing reads. A panel language with no dictionary loads none, where English was loaded in its place.
