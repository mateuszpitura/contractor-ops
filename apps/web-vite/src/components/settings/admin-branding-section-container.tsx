// Decision: section gated upstream by SettingsIndexContainer tab visibility (`general`);
// view owns isLoading/permission branches via hook's props bag (kept here to avoid breaking
// view's existing test contract — see __tests__/admin-branding-section.test.tsx).

import { AdminBrandingSection } from './admin-branding-section.js';
import { useAdminBrandingSection } from './hooks/use-admin-branding-section.js';

export function AdminBrandingSectionContainer() {
  const section = useAdminBrandingSection();
  return <AdminBrandingSection {...section} />;
}
