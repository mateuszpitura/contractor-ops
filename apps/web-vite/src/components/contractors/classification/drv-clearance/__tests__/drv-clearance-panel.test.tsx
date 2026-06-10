/**
 * web-vite port. Tests `StatusfeststellungsverfahrenPanelView` directly with
 * stubbed row data and upload mutation. The Dialog container is mocked to
 * avoid pulling tRPC into the test.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../drv-clearance-form.js', () => ({
  DrvClearanceForm: ({ open }: { open: boolean }) =>
    open ? (
      <div role="dialog">
        <h2>File DRV clearance procedure</h2>
      </div>
    ) : null,
}));

import { render, screen, setup } from '../../../../../test/test-utils.js';
import { StatusfeststellungsverfahrenPanelView } from '../drv-clearance-panel.js';

function makeUploadMutation() {
  return { mutate: vi.fn(), isPending: false } as unknown as Parameters<
    typeof StatusfeststellungsverfahrenPanelView
  >[0]['uploadMutation'];
}

describe('StatusfeststellungsverfahrenPanelView', () => {
  it('renders empty state when there are zero clearances', () => {
    render(
      <StatusfeststellungsverfahrenPanelView
        engagementId="ca-1"
        rows={[]}
        uploadMutation={makeUploadMutation()}
        uploadPending={false}
      />,
    );
    expect(screen.getByText(/No DRV clearance on file/i)).toBeInTheDocument();
  });

  it('renders one row per clearance with the DRV reference', () => {
    const in90Days = new Date();
    in90Days.setDate(in90Days.getDate() + 90);
    render(
      <StatusfeststellungsverfahrenPanelView
        engagementId="ca-1"
        rows={[
          {
            id: 'sfv-1',
            filedAt: new Date('2026-01-15').toISOString(),
            drvReference: 'DRV-2026-0001',
            outcome: 'SELBSTANDIG',
            validFrom: new Date('2026-01-15').toISOString(),
            validTo: in90Days.toISOString(),
            notes: null,
          },
        ]}
        uploadMutation={makeUploadMutation()}
        uploadPending={false}
      />,
    );
    expect(screen.getByText('DRV-2026-0001')).toBeInTheDocument();
    expect(screen.getByText(/Self-employed/i)).toBeInTheDocument();
  });

  it('exposes an accessible panel heading via aria-labelledby', () => {
    render(
      <StatusfeststellungsverfahrenPanelView
        engagementId="ca-1"
        rows={[]}
        uploadMutation={makeUploadMutation()}
        uploadPending={false}
      />,
    );
    const title = screen.getByText(/Statusfeststellungsverfahren \(DRV clearance\)/i);
    expect(title).toBeInTheDocument();
    expect(title.id).toBeTruthy();
    expect(title.closest('[aria-labelledby]')?.getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('opens the create dialog when the primary CTA is activated', async () => {
    const { user } = setup(
      <StatusfeststellungsverfahrenPanelView
        engagementId="ca-1"
        rows={[]}
        uploadMutation={makeUploadMutation()}
        uploadPending={false}
      />,
    );
    const cta = screen.getByRole('button', { name: /File new clearance/i });
    await user.click(cta);
    expect(await screen.findByText(/File DRV clearance procedure/i)).toBeInTheDocument();
  });
});
