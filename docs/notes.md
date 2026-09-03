src/lib/core/factory/config/augment-prototypes.ts should be handled by the prototype itself with either a prototype specific feature or an augment on the defineprototype

___

src/lib/core/operations/build-pipeline.server.ts
src/lib/core/operations/pipeline-order.spec.ts
src/lib/core/operations/resolve-pipeline.spec.ts
src/lib/core/operations/steps
src/lib/core/factory/hooks.ts

are all related to hooks and should live either togethers or be converted to appropriate hooks either prototypes hooks not imolemented already or features hooks (having one feature for only a hook may be ceremony)

___

src/lib/core/factory/config/augment-plugins.server.ts and src/lib/core/factory/config/augment-plugins.ts

may probably merge into one as now plugins are declared isomorphic

___


src/lib/core/factory/config/augment-icons.ts
src/lib/core/factory/config/augment-panel.ts
src/lib/core/factory/config/augment-panel-access.ts

are panel related and may be a feature even if the panel itself has not been includes in the restructuration, but these may land somewhere and a panel feature would be a start.