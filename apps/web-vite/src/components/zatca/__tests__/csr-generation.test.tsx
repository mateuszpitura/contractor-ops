/**
 * Web-vite port of apps/web/src/components/zatca/__tests__/csr-generation.test.tsx.
 *
 * Container splits the step into CsrGenerationIdle (no CSR yet) and
 * CsrGenerationGenerated (preview + Next). Tests render each sibling
 * directly with live EN translations.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { useTranslations } from '../../../i18n/useTranslations';

import { CsrGenerationGenerated, CsrGenerationIdle } from '../csr-generation';

function IdleHarness(props: {
  isPending?: boolean;
  generateCsr?: () => void;
  onBack?: () => void;
}) {
  const t = useTranslations('Zatca.csrGeneration');
  const tAria = useTranslations('Common.aria');
  return (
    <CsrGenerationIdle
      onBack={props.onBack ?? vi.fn()}
      generateCsr={props.generateCsr ?? vi.fn()}
      isPending={props.isPending ?? false}
      t={t}
      tAria={tAria}
    />
  );
}

function GeneratedHarness(props: { csrPem?: string; onSuccess?: () => void; onBack?: () => void }) {
  const t = useTranslations('Zatca.csrGeneration');
  return (
    <CsrGenerationGenerated
      onSuccess={props.onSuccess ?? vi.fn()}
      onBack={props.onBack ?? vi.fn()}
      csrPem={props.csrPem ?? '-----BEGIN CERTIFICATE REQUEST-----...'}
      t={t}
    />
  );
}

describe('CsrGeneration (web-vite)', () => {
  it('renders step title and description', () => {
    render(<IdleHarness />);
    expect(screen.getByText('Step 2 of 5: Generate Certificate Request')).toBeInTheDocument();
    expect(screen.getByText(/A Certificate Signing Request will be generated/)).toBeInTheDocument();
  });

  it('renders key type info', () => {
    render(<IdleHarness />);
    expect(screen.getByText('Key Type:')).toBeInTheDocument();
    expect(screen.getByText('ECDSA P-256 (recommended by ZATCA)')).toBeInTheDocument();
  });

  it('renders Generate CSR button when CSR not yet generated', () => {
    render(<IdleHarness />);
    expect(screen.getByRole('button', { name: /generate csr/i })).toBeInTheDocument();
  });

  it('renders Back button', () => {
    render(<IdleHarness />);
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
  });

  it('calls onBack when Back is clicked', async () => {
    const onBack = vi.fn();
    const { user } = setup(<IdleHarness onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('disables Generate CSR button while pending', () => {
    render(<IdleHarness isPending />);
    expect(screen.getByRole('button', { name: /generate csr/i })).toBeDisabled();
  });

  it('invokes generateCsr when Generate button is clicked', async () => {
    const generateCsr = vi.fn();
    const { user } = setup(<IdleHarness generateCsr={generateCsr} />);
    await user.click(screen.getByRole('button', { name: /generate csr/i }));
    expect(generateCsr).toHaveBeenCalledOnce();
  });

  it('does not render Next button in idle variant', () => {
    render(<IdleHarness />);
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument();
  });

  it('renders Next button in generated variant', () => {
    render(<GeneratedHarness />);
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate csr/i })).not.toBeInTheDocument();
  });

  it('renders the CSR preview in generated variant', () => {
    render(<GeneratedHarness csrPem="-----BEGIN CERTIFICATE REQUEST-----\nAAAA\n-----END..." />);
    expect(screen.getByText('CSR Preview (read-only)')).toBeInTheDocument();
  });

  it('invokes onSuccess when Next is clicked after CSR is generated', async () => {
    const onSuccess = vi.fn();
    const { user } = setup(<GeneratedHarness onSuccess={onSuccess} />);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
