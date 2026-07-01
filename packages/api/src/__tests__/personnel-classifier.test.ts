/**
 * Document → section classifier scaffold (taxonomy-first, AI fallback, admin last).
 *
 * Routing pinned before the service exists:
 *   (a) deterministic taxonomy hit → method DETERMINISTIC, section assigned,
 *       NO Claude call
 *   (b) taxonomy miss + kill-switch ON + AI top confidence 92 (margin >= 15) →
 *       method AI, section = top guess
 *   (c) taxonomy miss + kill-switch OFF / Unleash-unreachable → routed to the
 *       admin step (PENDING_REVIEW), upload NOT blocked, NO Claude call
 *   (d) taxonomy miss + AI top confidence below the 85 threshold → admin step
 *
 * The kill-switch evaluator and the Claude adapter are injected seams so the
 * routing is deterministic without a live flag backend or model call. Terminal-
 * RED via the missing `../services/personnel-classifier` module; the test
 * directory is excluded from tsc so the missing module does not brick the
 * package typecheck.
 */

import { describe, expect, it, vi } from 'vitest';
// The service does not exist yet — this import is the terminal-RED anchor.
import { classifyPersonnelDocument } from '../services/personnel-classifier.js';

type SectionGuess = { section: 'A' | 'B' | 'C' | 'D'; confidence: number; margin: number };

function makeSeams(overrides?: {
  killSwitchEnabled?: boolean;
  killSwitchReason?: string;
  claudeResult?: SectionGuess;
}) {
  const evaluateKillSwitch = vi.fn(() => ({
    enabled: overrides?.killSwitchEnabled ?? true,
    reason: overrides?.killSwitchReason ?? 'enabled',
  }));
  const classifyWithClaude = vi.fn(
    async () => overrides?.claudeResult ?? { section: 'B', confidence: 92, margin: 20 },
  );
  return { evaluateKillSwitch, classifyWithClaude };
}

describe('classifier — deterministic taxonomy hit', () => {
  it('assigns a section deterministically and never calls Claude', async () => {
    const { evaluateKillSwitch, classifyWithClaude } = makeSeams();
    const result = await classifyPersonnelDocument(
      {
        jurisdiction: 'PL',
        documentType: 'TAX_CERTIFICATE',
        storageKey: 'k',
        organizationId: 'org',
        region: 'EU',
      },
      { evaluateKillSwitch, classifyWithClaude },
    );

    expect(result.classificationMethod).toBe('DETERMINISTIC');
    expect(['A', 'B', 'C', 'D']).toContain(result.section);
    expect(classifyWithClaude).not.toHaveBeenCalled();
  });
});

describe('classifier — AI fallback on taxonomy miss', () => {
  it('assigns the top AI guess when confidence clears the threshold with margin', async () => {
    const { evaluateKillSwitch, classifyWithClaude } = makeSeams({
      claudeResult: { section: 'B', confidence: 92, margin: 20 },
    });
    const result = await classifyPersonnelDocument(
      {
        jurisdiction: 'PL',
        documentType: 'OTHER',
        storageKey: 'k',
        organizationId: 'org',
        region: 'EU',
      },
      { evaluateKillSwitch, classifyWithClaude },
    );

    expect(result.classificationMethod).toBe('AI');
    expect(result.section).toBe('B');
    expect(classifyWithClaude).toHaveBeenCalledTimes(1);
  });
});

describe('classifier — kill-switch off routes to the admin step', () => {
  it('routes to PENDING_REVIEW without blocking the upload and never calls Claude', async () => {
    const { evaluateKillSwitch, classifyWithClaude } = makeSeams({
      killSwitchEnabled: false,
      killSwitchReason: 'unleash-unreachable',
    });
    const result = await classifyPersonnelDocument(
      {
        jurisdiction: 'PL',
        documentType: 'OTHER',
        storageKey: 'k',
        organizationId: 'org',
        region: 'EU',
      },
      { evaluateKillSwitch, classifyWithClaude },
    );

    expect(result.classificationMethod).toBe('PENDING');
    expect(result.status).toBe('PENDING_REVIEW');
    expect(result.uploadBlocked).toBe(false);
    expect(classifyWithClaude).not.toHaveBeenCalled();
  });
});

describe('classifier — low AI confidence routes to the admin step', () => {
  it('routes to PENDING_REVIEW when top confidence is below the threshold', async () => {
    const { evaluateKillSwitch, classifyWithClaude } = makeSeams({
      claudeResult: { section: 'B', confidence: 70, margin: 5 },
    });
    const result = await classifyPersonnelDocument(
      {
        jurisdiction: 'PL',
        documentType: 'OTHER',
        storageKey: 'k',
        organizationId: 'org',
        region: 'EU',
      },
      { evaluateKillSwitch, classifyWithClaude },
    );

    expect(result.classificationMethod).toBe('PENDING');
    expect(result.status).toBe('PENDING_REVIEW');
  });
});
