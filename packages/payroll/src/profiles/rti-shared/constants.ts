// HMRC RTI (Real Time Information) shared envelope contract.
//
// FPS (Full Payment Submission) and EPS (Employer Payment Summary) share the
// GovTalkMessage → IRenvelope envelope. These exports are RTI-compatible for
// import into Sage / BrightPay / Moneysoft; direct HMRC submission over the
// Government Gateway is a separate deliverable (deferred to v7.5). The schema
// year + namespaces are pinned here and locked by golden fixtures; statutory
// correctness is a deferred adviser-verify checkpoint (HMRC RTI schema + agent).

export const RTI_ENVELOPE_NAMESPACE = 'http://www.govtalk.gov.uk/CM/envelope';

export const RTI_FPS_CLASS = 'HMRC-PAYE-RTI-FPS';
export const RTI_EPS_CLASS = 'HMRC-PAYE-RTI-EPS';

export const RTI_FPS_NAMESPACE =
  'http://www.govtalk.gov.uk/taxation/PAYE/RTI/FullPaymentSubmission/23-24/1';
export const RTI_EPS_NAMESPACE =
  'http://www.govtalk.gov.uk/taxation/PAYE/RTI/EmployerPaymentSummary/23-24/1';

export const RTI_FLAG_KEY = 'payroll.sage-uk';

/** Split a PAYE reference "123/AB456" into { officeNo, payeRef }. */
export function splitPayeRef(payeReference: string): { officeNo: string; payeRef: string } {
  const [officeNo, payeRef] = payeReference.split('/');
  return { officeNo: officeNo ?? '', payeRef: payeRef ?? payeReference };
}
