// @contractor-ops/ui — Atelier visual system
//
// CSS layer: tokens, glass tiers, motion baseline, status palette
//   apps import via @import "@contractor-ops/ui/styles/{tokens,glass,motion,status}.css"
//
// React layer:
//   - components/atelier:   premium dashboard primitives (TiltCard,
//                           AnimatedNumber, Sparkline, Ring, PulseDot,
//                           SectionLabel, AtelierStatusPill,
//                           AtelierBackground, AtelierIntensityProvider)
//   - components/workbench: dense-page chrome (AtelierPageHeader,
//                           AtelierToolbar, AtelierTableShell,
//                           AtelierEmptyState, AtelierPanel)
//   - status:               domain-aware status → variant mapper

// biome-ignore-start lint/performance/noReExportAll: package barrel — every export is opt-in via the named module above
export * from './components/atelier/index.js';
export * from './components/workbench/index.js';
export { useHoverCapability } from './hooks/use-hover-capability.js';
export { useReducedMotion } from './hooks/use-reduced-motion.js';
export { type IconSize, iconSize } from './icons/sizes.js';
export * from './status/index.js';
// biome-ignore-end lint/performance/noReExportAll: package barrel
