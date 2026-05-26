import { KleinunternehmerToggleContainer } from '../organization/kleinunternehmer-toggle-container.js';
import { useOrgKleinunternehmer } from './hooks/use-org-kleinunternehmer.js';
import { useOrgSettingsForm } from './hooks/use-org-settings-form.js';
import { OrgSettingsForm, OrgSettingsFormSkeleton } from './org-settings-form.js';

export function OrgSettingsFormContainer() {
  const form = useOrgSettingsForm();
  const kleinunternehmer = useOrgKleinunternehmer();

  if (form.isLoading) return <OrgSettingsFormSkeleton />;
  return (
    <div className="space-y-6">
      <OrgSettingsForm {...form} />
      {!kleinunternehmer.isLoading && (
        <KleinunternehmerToggleContainer
          orgCountryCode={kleinunternehmer.orgCountryCode}
          isKleinunternehmer={kleinunternehmer.isKleinunternehmer}
        />
      )}
    </div>
  );
}
