/**
 * Per-probe HTTP journal for correlating tRPC failures with render gates.
 */

export interface JournalEvent {
  atMs: number;
  kind: 'response' | 'requestfailed' | 'navigation';
  url: string;
  status?: number;
  statusText?: string;
  procedure?: string;
  errorText?: string;
}

export class RequestJournal {
  private readonly events: JournalEvent[] = [];
  private t0 = Date.now();

  markStart(): void {
    this.t0 = Date.now();
    this.events.length = 0;
  }

  private atMs(): number {
    return Date.now() - this.t0;
  }

  recordResponse(url: string, status: number, statusText: string): void {
    const procedure = extractTrpcProcedure(url);
    this.events.push({
      atMs: this.atMs(),
      kind: 'response',
      url,
      status,
      statusText,
      procedure,
    });
  }

  recordRequestFailed(url: string, errorText: string): void {
    this.events.push({
      atMs: this.atMs(),
      kind: 'requestfailed',
      url,
      errorText,
      procedure: extractTrpcProcedure(url),
    });
  }

  recordNavigation(url: string, status: number): void {
    this.events.push({
      atMs: this.atMs(),
      kind: 'navigation',
      url,
      status,
    });
  }

  getEvents(): readonly JournalEvent[] {
    return this.events;
  }

  /** Summarize for finding detail (truncated). */
  toDetail(max = 8): string {
    return JSON.stringify(this.events.slice(0, max), null, 0);
  }

  findCriticalProcedureFailures(
    procedures: readonly { name: string; critical?: boolean }[],
  ): JournalEvent[] {
    const names = new Set(procedures.filter(p => p.critical !== false).map(p => p.name));
    if (names.size === 0) return [];
    return this.events.filter(
      e =>
        e.procedure &&
        names.has(e.procedure) &&
        ((e.status !== undefined && e.status >= 500) ||
          (e.status === 404 && e.kind === 'response')),
    );
  }

  countNotFoundPatterns(): number {
    return this.events.filter(e => e.status === 404 && e.url.includes('/api/trpc/')).length;
  }
}

function extractTrpcProcedure(url: string): string | undefined {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const idx = path.indexOf('/api/trpc/');
    if (idx === -1) return;
    const rest = path.slice(idx + '/api/trpc/'.length);
    const proc = rest.split('/')[0]?.split('?')[0];
    return proc || undefined;
  } catch {
    return;
  }
}
