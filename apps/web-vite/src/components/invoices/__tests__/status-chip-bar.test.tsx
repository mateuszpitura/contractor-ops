import { render, screen, setup } from '@/test/test-utils';

import { StatusChipBarSkeleton, StatusChipBarView } from '../status-chip-bar';

describe('StatusChipBar', () => {
  it('skeleton renders without toggle buttons', () => {
    render(<StatusChipBarSkeleton />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('renders chip labels with counts derived from the counts map', () => {
    render(
      <StatusChipBarView
        activeStatuses={['RECEIVED']}
        onStatusChange={vi.fn()}
        counts={{
          'status:RECEIVED': 2,
          'status:APPROVED': 1,
          'matchStatus:MATCHED': 4,
        }}
      />,
    );

    expect(screen.getByRole('switch', { name: /Received\(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Approved\(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Matched\(4\)/i })).toBeInTheDocument();
  });

  it('marks the active status with aria-checked=true', () => {
    render(
      <StatusChipBarView
        activeStatuses={['RECEIVED']}
        onStatusChange={vi.fn()}
        counts={{ 'status:RECEIVED': 2 }}
      />,
    );
    expect(screen.getByRole('switch', { name: /Received/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('adds the clicked inactive chip to the selection', async () => {
    const onStatusChange = vi.fn();
    const { user } = setup(
      <StatusChipBarView
        activeStatuses={['RECEIVED']}
        onStatusChange={onStatusChange}
        counts={{ 'status:RECEIVED': 2, 'status:APPROVED': 1 }}
      />,
    );

    await user.click(screen.getByRole('switch', { name: /Approved/i }));
    expect(onStatusChange).toHaveBeenCalledWith(['RECEIVED', 'APPROVED']);
  });

  it('deselects an active chip when clicked again', async () => {
    const onStatusChange = vi.fn();
    const { user } = setup(
      <StatusChipBarView
        activeStatuses={['RECEIVED', 'MATCHED']}
        onStatusChange={onStatusChange}
      />,
    );

    await user.click(screen.getByRole('switch', { name: /Received/i }));
    expect(onStatusChange).toHaveBeenCalledWith(['MATCHED']);
  });
});
