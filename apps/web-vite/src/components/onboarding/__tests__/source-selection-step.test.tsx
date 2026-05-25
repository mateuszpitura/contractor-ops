/**
 * Step 10 port of apps/web/src/components/onboarding/__tests__/source-selection-step.test.tsx.
 *
 * The web-vite SourceSelectionStep is presentational: it consumes a shaped
 * `sources` list plus selection state and exposes the connect / toggle /
 * refetch / skip callbacks. The OAuth popup + tRPC connection mutation
 * live in the container.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingSource } from '../hooks/use-onboarding-source-selection.js';
import { SourceSelectionError, SourceSelectionStep } from '../source-selection-step.js';
import { click, findButton, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const baseSources: OnboardingSource[] = [
  { provider: 'JIRA', connected: true },
  { provider: 'LINEAR', connected: false },
];

function baseProps() {
  return {
    sources: baseSources,
    selectedSources: ['JIRA'],
    onToggle: vi.fn(),
    onConnect: vi.fn(),
    onSkip: vi.fn(),
  };
}

describe('SourceSelectionStep (web-vite)', () => {
  it('renders the heading + subtitle from the OnboardingImport.step1 namespace', async () => {
    const { container } = await mount(<SourceSelectionStep {...baseProps()} />);
    expect(container.textContent).toContain('Where do you manage your team?');
    expect(container.textContent).toContain('Select the tools');
  });

  it('renders one SourceCard per provider with the human-readable name', async () => {
    const { container } = await mount(<SourceSelectionStep {...baseProps()} />);
    expect(container.textContent).toContain('Jira');
    expect(container.textContent).toContain('Linear');
  });

  it('renders the skip link at the bottom', async () => {
    const { container } = await mount(<SourceSelectionStep {...baseProps()} />);
    expect(container.textContent).toContain("Skip — I'll invite people manually");
  });

  it('invokes onSkip when the skip link is clicked', async () => {
    const onSkip = vi.fn();
    const { container } = await mount(<SourceSelectionStep {...baseProps()} onSkip={onSkip} />);
    const link = findButton(container, /skip/i);
    expect(link).not.toBeNull();
    await click(link as HTMLButtonElement);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('renders the error sibling with retry button + skip link', async () => {
    const onRefetch = vi.fn();
    const onSkip = vi.fn();
    const { container } = await mount(
      <SourceSelectionError onRefetch={onRefetch} onSkip={onSkip} />,
    );
    const retry = findButton(container, /try again/i);
    expect(retry).not.toBeNull();
    await click(retry as HTMLButtonElement);
    expect(onRefetch).toHaveBeenCalledTimes(1);
  });
});
