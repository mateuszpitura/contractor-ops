/**
 * Run manifest — canonical index of all screenshots.
 */

import type { Locale, Theme } from './routes.js';

export interface ManifestShot {
  index: number;
  locale: Locale;
  routeId: string;
  viewport: string;
  theme: Theme;
  variant: string;
  surfaceId?: string;
  kind?: string;
  status: 'success' | 'broken' | 'loading' | 'capture-missing';
  file: string;
  findings: number;
  diffPath?: string;
}

export interface CoverageByRoute {
  expected: number;
  captured: number;
}

export interface Manifest {
  runId: string;
  startedAt: string;
  finishedAt: string;
  shots: ManifestShot[];
  coverage: {
    expected: number;
    captured: number;
    missing: number;
    byRoute: Record<string, CoverageByRoute>;
  };
  galleryAudit: {
    successScreenshots: number;
    brokenScreenshots: number;
    loadingScreenshots: number;
    captureMissing: number;
    notFoundPatternCount: number;
    suspectedSeedMismatch: boolean;
  };
}

export class ManifestBuilder {
  readonly shots: ManifestShot[] = [];
  private expectedByRoute = new Map<string, number>();
  private capturedByRoute = new Map<string, number>();
  notFoundPatternCount = 0;

  setExpected(routeId: string, count: number): void {
    this.expectedByRoute.set(routeId, count);
  }

  addShot(shot: ManifestShot): void {
    this.shots.push(shot);
    if (shot.status === 'success') {
      const id = shot.routeId;
      this.capturedByRoute.set(id, (this.capturedByRoute.get(id) ?? 0) + 1);
    }
  }

  build(runId: string, startedAt: string, finishedAt: string): Manifest {
    let expected = 0;
    for (const n of this.expectedByRoute.values()) expected += n;
    let captured = 0;
    const byRoute: Record<string, CoverageByRoute> = {};
    for (const [routeId, exp] of this.expectedByRoute) {
      const cap = this.capturedByRoute.get(routeId) ?? 0;
      byRoute[routeId] = { expected: exp, captured: cap };
      captured += cap;
    }
    const successScreenshots = this.shots.filter(s => s.status === 'success').length;
    const brokenScreenshots = this.shots.filter(s => s.status === 'broken').length;
    const loadingScreenshots = this.shots.filter(s => s.status === 'loading').length;
    const captureMissing = this.shots.filter(s => s.status === 'capture-missing').length;
    const routeCount = this.expectedByRoute.size || 1;
    const suspectedSeedMismatch = this.notFoundPatternCount / routeCount > 0.15;

    return {
      runId,
      startedAt,
      finishedAt,
      shots: this.shots,
      coverage: {
        expected,
        captured,
        missing: Math.max(0, expected - captured),
        byRoute,
      },
      galleryAudit: {
        successScreenshots,
        brokenScreenshots,
        loadingScreenshots,
        captureMissing,
        notFoundPatternCount: this.notFoundPatternCount,
        suspectedSeedMismatch,
      },
    };
  }
}
