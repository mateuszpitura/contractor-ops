// Phase 62 · Plan 62-02 Task 5 — ZUGFeRD profile barrel.
//
// Public surface consumed by:
//   * `packages/einvoice/src/registry.ts` — profile registration
//   * `packages/einvoice/src/index.ts` — top-level package re-export
//   * `packages/api/src/services/invoice-intake-service.ts` — intake pipeline

export * from './constants.js';
export * from './schemas.js';
// Explicit re-export so tooling (grep, bundler analysis) sees the symbol
// listed directly in the barrel — also documents the public surface.
export { ZUGFERD_DE_PROFILE_ID } from './constants.js';
export { parseZugferdPdf } from './parser.js';
export type { ParsedZugferd, ZugferdParserError } from './parser.js';
export { validateZugferdEmbeddedXml } from './validator.js';
export { ZugferdDEProfile } from './profile.js';
// Plan 62-03: outbound pipeline.
export {
  generateZugferdPdf,
  ZugferdLevelUnsupportedForOutput,
} from './generator.js';
export type { GenerateZugferdInput } from './generator.js';
export {
  assertZugferdStructure,
  ZugferdWrappingError,
} from './zugferd-structural-check.js';
export type { StructuralCheckSubcode } from './zugferd-structural-check.js';
