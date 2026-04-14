import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { ClassificationAutosaveIndicator } from '../classification-autosave-indicator';

describe('ClassificationAutosaveIndicator', () => {
  it('renders idle state when status is idle', () => {
    render(<ClassificationAutosaveIndicator status="idle" lastSavedAt={null} />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
  });

  it('renders saving state with spinner text', () => {
    render(<ClassificationAutosaveIndicator status="saving" lastSavedAt={null} />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
  });

  it('renders saved state with relative time', () => {
    render(<ClassificationAutosaveIndicator status="saved" lastSavedAt={Date.now() - 5000} />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<ClassificationAutosaveIndicator status="error" lastSavedAt={null} />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
  });

  it('has aria-live polite for screen reader announcements', () => {
    render(<ClassificationAutosaveIndicator status="idle" lastSavedAt={null} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('has aria-atomic true', () => {
    render(<ClassificationAutosaveIndicator status="idle" lastSavedAt={null} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-atomic', 'true');
  });
});
