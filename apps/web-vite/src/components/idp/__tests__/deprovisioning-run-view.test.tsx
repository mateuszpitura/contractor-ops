/**
 * DeprovisioningRunView presentational tests.
 * Asserts LIKELY_GONE/MANUAL_COMPLETED rendering and that the per-failed-step
 * "Mark complete" button appears only for overridable steps.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeprovisioningRunView } from '../deprovisioning-run-view.js';
import type { DeprovisioningStepView } from '../hooks/use-deprovisioning-run.js';
import { findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function step(overrides: Partial<DeprovisioningStepView>): DeprovisioningStepView {
  return {
    id: 's-1',
    provider: 'GOOGLE_WORKSPACE',
    stepKind: 'SUSPEND_ACCOUNT',
    status: 'SUCCEEDED',
    attempts: 1,
    errorClass: null,
    lastErrorMessage: null,
    manualOverrideCategory: null,
    manualOverrideNote: null,
    manualOverriddenByUserId: null,
    manualOverriddenAt: null,
    canMarkComplete: false,
    ...overrides,
  };
}

const noop = () => {};
const asyncNoop = async () => {};

describe('DeprovisioningRunView (web-vite)', () => {
  it('renders a SUCCEEDED step (LIKELY_GONE folds to SUCCEEDED upstream)', async () => {
    await mount(
      <DeprovisioningRunView
        steps={[step({ status: 'SUCCEEDED' })]}
        overrideStepId={null}
        onOpenOverride={noop}
        onSubmitOverride={asyncNoop}
        overridePending={false}
      />,
    );
    expect(findByText(document.body, /Succeeded/)).not.toBeNull();
  });

  it('renders the override badge on a MANUAL_COMPLETED step', async () => {
    await mount(
      <DeprovisioningRunView
        steps={[
          step({
            status: 'MANUAL_COMPLETED',
            manualOverrideCategory: 'verified_via_vendor_console',
            manualOverriddenByUserId: 'usr_admin',
            manualOverriddenAt: '2026-05-31T00:00:00Z',
          }),
        ]}
        overrideStepId={null}
        onOpenOverride={noop}
        onSubmitOverride={asyncNoop}
        overridePending={false}
      />,
    );
    expect(findByText(document.body, /Manually completed/)).not.toBeNull();
  });

  it('shows "Mark complete" only for overridable (FAILED+exhausted+canOverride) steps', async () => {
    const onOpen = vi.fn();
    const { unmount } = await mount(
      <DeprovisioningRunView
        steps={[step({ status: 'FAILED', attempts: 3, canMarkComplete: true })]}
        overrideStepId={null}
        onOpenOverride={onOpen}
        onSubmitOverride={asyncNoop}
        overridePending={false}
      />,
    );
    const btn = findByText(document.body, /Mark complete/);
    expect(btn).not.toBeNull();
    unmount();
  });

  it('hides "Mark complete" when the step is not overridable', async () => {
    await mount(
      <DeprovisioningRunView
        steps={[step({ status: 'FAILED', attempts: 3, canMarkComplete: false })]}
        overrideStepId={null}
        onOpenOverride={noop}
        onSubmitOverride={asyncNoop}
        overridePending={false}
      />,
    );
    expect(findByText(document.body, /^Mark complete$/)).toBeNull();
  });
});
