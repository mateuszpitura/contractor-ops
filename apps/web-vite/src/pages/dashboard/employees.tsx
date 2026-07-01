/**
 * Employees — per-market registration route, reached only when
 * `module.workforce-employees` is enabled. The registration surface removes
 * itself from the render tree when the flag is OFF, so the gated dashboard link
 * never resolves to a stub or a 404.
 */

import { EmployeeRegistrationPage } from '../../components/employees/employee-registration-page.js';

export default function EmployeesPage() {
  return <EmployeeRegistrationPage />;
}
