/**
 * web-vite port. View takes ownerItems + teams + projects + costCenters directly.
 */

import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../../../test/test-utils.js';
import { StepAssignmentView } from '../step-assignment.js';
import type { WizardFormValues } from '../wizard-dialog.js';

type StepAssignmentViewParams = Parameters<typeof StepAssignmentView>[0];

function Wrapper({
  ownerItems = [
    { value: 'u1', label: 'Jan Kowalski' },
    { value: 'u2', label: 'Anna Nowak' },
  ] as StepAssignmentViewParams['ownerItems'],
  teams = [] as unknown as StepAssignmentViewParams['teams'],
  projects = [] as unknown as StepAssignmentViewParams['projects'],
  costCenters = [] as unknown as StepAssignmentViewParams['costCenters'],
} = {}) {
  const form = useForm<WizardFormValues>({
    defaultValues: {
      ownerUserId: '',
      primaryTeamId: '',
      primaryProjectId: '',
      defaultCostCenterId: '',
    } as WizardFormValues,
  });
  return (
    <StepAssignmentView
      form={form}
      ownerItems={ownerItems}
      teams={teams}
      projects={projects}
      costCenters={costCenters}
    />
  );
}

describe('StepAssignmentView', () => {
  it('renders the four labelled dropdown fields', () => {
    render(<Wrapper />);
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(4);
  });

  it('renders owner placeholder when no owner is selected', () => {
    render(<Wrapper />);
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0);
  });

  it('renders team/project/cost center labels', () => {
    render(<Wrapper />);
    expect(screen.getAllByText('Team').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Project').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cost center').length).toBeGreaterThan(0);
  });
});
