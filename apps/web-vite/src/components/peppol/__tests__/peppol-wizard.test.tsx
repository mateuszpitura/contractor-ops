/**
 * Step-10 port + decisive-container refactor. The step branching now lives in
 * the container; each step is its own single-render-path sub-component.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../../test/test-utils.js';
import {
  PeppolWizardShell,
  PeppolWizardStep1,
  PeppolWizardStep2,
  PeppolWizardStep3,
  PeppolWizardStep4,
  PeppolWizardStep5,
} from '../peppol-wizard.js';

describe('PeppolWizardShell (web-vite)', () => {
  it('renders the dialog title and step indicator when open', () => {
    render(
      <PeppolWizardShell open step={1} onOpenChange={vi.fn()} footer={null}>
        <div>body</div>
      </PeppolWizardShell>,
    );
    expect(screen.getByText(/Connect to Peppol Network/i)).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });
});

describe('PeppolWizardStep1 (web-vite)', () => {
  it('renders the TRN heading and input', () => {
    render(<PeppolWizardStep1 trn="" setTrn={vi.fn()} participantId="0184:NL000000001" />);
    expect(screen.getByText(/Step 1: Tax Registration Number/i)).toBeInTheDocument();
    expect(screen.getByText('0184:NL000000001')).toBeInTheDocument();
  });
});

describe('PeppolWizardStep2 (web-vite)', () => {
  it('renders the ASP selection heading', () => {
    render(<PeppolWizardStep2 aspProvider="storecove" />);
    expect(screen.getByText(/Step 2: Select ASP Provider/i)).toBeInTheDocument();
  });
});

describe('PeppolWizardStep3 (web-vite)', () => {
  it('renders the API credentials input', () => {
    render(
      <PeppolWizardStep3
        apiKey=""
        setApiKey={vi.fn()}
        showApiKey={false}
        toggleShowApiKey={vi.fn()}
        environment="sandbox"
        setEnvironment={vi.fn()}
      />,
    );
    expect(screen.getByText(/Step 3: API Credentials/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Storecove API Key/i)).toBeInTheDocument();
  });
});

describe('PeppolWizardStep4 (web-vite)', () => {
  it('renders the registering progress when isPending', () => {
    render(
      <PeppolWizardStep4
        participantId="0184:NL000000001"
        environment="sandbox"
        isPending={true}
        registrationError={null}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/Registering your organization/i)).toBeInTheDocument();
  });

  it('renders the registration failure alert and retry button', () => {
    render(
      <PeppolWizardStep4
        participantId="0184:NL000000001"
        environment="sandbox"
        isPending={false}
        registrationError="Storecove rejected the request"
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/Registration Failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Storecove rejected the request/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });
});

describe('PeppolWizardStep5 (web-vite)', () => {
  it('renders the success screen', () => {
    render(<PeppolWizardStep5 participantId="0184:NL000000001" environment="sandbox" />);
    expect(screen.getByText(/Connected to Peppol Network/i)).toBeInTheDocument();
  });
});
