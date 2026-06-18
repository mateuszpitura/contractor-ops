import { beforeEach, describe, expect, it } from 'vitest';
import { click, mount } from '../../../dashboard/__tests__/_render.js';
import { useContractorListView } from '../../hooks/use-contractor-list-view.js';
import { CompositionStrip } from '../composition-strip.js';
import type { ContractorComposition } from '../types.js';

function ViewModeHarness() {
  const { mode, setMode } = useContractorListView();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button type="button" onClick={() => setMode('tabbed')}>
        set-tabbed
      </button>
    </div>
  );
}

describe('useContractorListView store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to visuals-first and persists the chosen mode', async () => {
    const { container, unmount } = await mount(<ViewModeHarness />);
    try {
      expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe('visuals-first');

      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      await click(button as HTMLButtonElement);

      expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe('tabbed');
      expect(localStorage.getItem('contractor-list-view')).toContain('tabbed');
    } finally {
      unmount();
    }
  });
});

const COMPOSITION: ContractorComposition = {
  // LIFECYCLE_ORDER puts ONBOARDING before ACTIVE → first chip is ONBOARDING,
  // independent of the active test locale.
  lifecycleStage: { ONBOARDING: 1, ACTIVE: 3 },
  type: { COMPANY: 2 },
  jurisdiction: [{ countryCode: 'DE', count: 2 }],
  health: { green: 2, yellow: 1, red: 1 },
};

describe('CompositionStrip', () => {
  it('toggles the clicked segment via onToggle', async () => {
    const toggled: [string, string][] = [];
    const { container, unmount } = await mount(
      <CompositionStrip
        composition={COMPOSITION}
        active={{ lifecycleStage: [], type: [], country: [], health: [] }}
        onToggle={(group, value) => toggled.push([group, value])}
      />,
    );
    try {
      const firstChip = container.querySelector<HTMLButtonElement>('button[aria-pressed]');
      expect(firstChip).not.toBeNull();
      await click(firstChip as HTMLButtonElement);
      expect(toggled[0]).toEqual(['lifecycleStage', 'ONBOARDING']);
    } finally {
      unmount();
    }
  });
});
