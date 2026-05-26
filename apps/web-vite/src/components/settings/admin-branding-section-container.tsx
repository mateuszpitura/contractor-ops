import { AdminBrandingSection } from './admin-branding-section.js';
import { useAdminBrandingSection } from './hooks/use-admin-branding-section.js';

// Decision: mutation host — branding section gated upstream by SettingsIndexContainer
// (`general` tab); hook supplies branding props bag + save handlers consumed by the view.
export function AdminBrandingSectionContainer() {
  const section = useAdminBrandingSection();
  return <AdminBrandingSection {...section} />;
}
