// US policy rules.
//
// Documents covered:
//  1. us.ip_assignment@v1 — IP assignment + work-made-for-hire backstop
//     (WARNING; non-expiring; offboarding-time concern)
//
// Legal-text status: PENDING per Standing Constraint (legal review DEFERRED).
// Production wording flips PENDING→APPROVED via post-deploy PR per
// `packages/validators/src/legal/signoff-registry.json` (`legal-signoff.ip_clauses.us.*`).

import { registerPolicyRule } from '../registry';

registerPolicyRule({
  policyRuleId: 'us.ip_assignment@v1',
  jurisdiction: 'US',
  documentType: 'IP_RATIFICATION',
  displayName: 'US Intellectual Property Assignment',
  severity: 'WARNING', // surfaces on the compliance dashboard; does NOT block payment
  expiryJurisdictionTz: 'America/New_York',
  appliesIf: () => true,
  draftLegalText:
    "US contractors must execute an IP-assignment with a work-made-for-hire backstop. Under 17 U.S.C. §201(b), works qualify as 'work made for hire' only when (a) the work falls into one of nine statutory categories AND (b) the parties expressly agree in writing. Where the work-made-for-hire doctrine does not apply, 17 U.S.C. §204(a) requires a written assignment signed by the rights-holder. Best practice is a dual clause: 'work made for hire to the extent permissible; otherwise hereby assigned'. (PENDING legal review by US tax/IP adviser)",
  expirySemantic: 'no_expiry', // executed IP assignment is permanent (non-expiring)
});

// No statutory annual-leave accrual rule and no working-time-limit rule are
// registered for the US: federal law mandates neither a paid-annual-leave floor
// (no FLSA/federal PTO entitlement) nor a maximum-hours cap (the FLSA sets an
// overtime premium above 40h/week but no ceiling on hours worked). Both are
// therefore employer/contract-governed, so resolveLeaveAccrual('US','ANNUAL')
// and resolveWtLimits('US') intentionally return undefined and the caller falls
// back to org policy. This absence is deliberate — do not add a fabricated rule.
// (State-level daily-overtime rules e.g. CA are out of scope for the federal
// 'US' jurisdiction key; PENDING legal review by US adviser.)
