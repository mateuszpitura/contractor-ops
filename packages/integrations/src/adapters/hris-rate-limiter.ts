// Conservative token-bucket rate limiter shared by the HRIS pull adapters.
//
// Personio publishes a per-credential request budget (community data puts it at
// ~200 req/min — MEDIUM confidence, verified against the contract at
// enablement). A burst pull that paginates a large directory must not exceed
// that budget, so each page fetch acquires a token first. The limiter is set
// conservatively: a tighter real limit still passes because we never issue
// faster than the configured drip rate.

/**
 * A token bucket that grants at most `maxPerWindow` permits per `windowMs`,
 * dripping one permit every `windowMs / maxPerWindow` ms. `acquire()` resolves
 * immediately while permits remain and otherwise queues, resolving in FIFO
 * order as permits drip back. Pure timers — no external dependency.
 */
export class RateLimiter {
  private available: number;
  private readonly queue: Array<() => void> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly maxPerWindow: number;
  private readonly intervalMs: number;

  constructor(maxPerWindow = 200, windowMs = 60_000) {
    this.maxPerWindow = maxPerWindow;
    this.available = maxPerWindow;
    this.intervalMs = Math.max(1, Math.floor(windowMs / maxPerWindow));
  }

  acquire(): Promise<void> {
    if (this.available > 0 && this.queue.length === 0) {
      this.available -= 1;
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      this.queue.push(resolve);
      this.startDrip();
    });
  }

  private startDrip(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.available = Math.min(this.maxPerWindow, this.available + 1);
      const next = this.queue.shift();
      if (next) {
        this.available -= 1;
        next();
      }
      if (this.queue.length === 0) {
        this.stopDrip();
      }
    }, this.intervalMs);
    // Never keep the process alive solely for the limiter.
    const t = this.timer as { unref?: () => void };
    if (typeof t.unref === 'function') t.unref();
  }

  private stopDrip(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/** The default HRIS limiter: ≤200 requests / 60s per credential (conservative). */
export function createHrisRateLimiter(): RateLimiter {
  return new RateLimiter(200, 60_000);
}
