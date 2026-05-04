// @contractor-ops/ui — Atelier visual system
//
// CSS layer: tokens, glass tiers, motion baseline, status palette
//   apps import via @import "@contractor-ops/ui/styles/{tokens,glass,motion,status}.css"
//
// React layer: Atelier primitives — TiltCard, AnimatedNumber, Sparkline,
// Ring, PulseDot, SectionLabel, AtelierStatusPill, AtelierBackground,
// AtelierIntensityProvider. See ./components/atelier for details.

export * from './components/atelier/index.js';
export { useHoverCapability } from './hooks/use-hover-capability.js';
export { useReducedMotion } from './hooks/use-reduced-motion.js';
