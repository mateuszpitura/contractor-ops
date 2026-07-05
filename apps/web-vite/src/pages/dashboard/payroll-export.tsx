/**
 * Payroll export — per-market payroll adapter route, reached only when
 * `module.workforce-employees` is enabled. The export surface removes itself
 * from the render tree when the flag is OFF, so the gated link never resolves
 * to a stub or a 404.
 */

import { PayrollExportPage } from '../../components/payroll/payroll-export-page.js';

export default function PayrollExportRoutePage() {
  return <PayrollExportPage />;
}
