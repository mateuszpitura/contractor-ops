// CI lint guard: every payment-write tRPC procedure must import and call
// assertContractorPaymentEligibility. Twin-write enforced — adding a new
// payment-write entry point requires updating BOTH the procedure AND
// PAYMENT_WRITE_PROCEDURES below.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Procedures live in packages/api/src/routers/finance/payment.ts and are mounted
// under the `payment` namespace in root.ts. There is no addItems/updateItems
// create-time entry point; the two payment-write entry points are create + lockAndExport.
export const PAYMENT_WRITE_PROCEDURES = new Set(['payment.create', 'payment.lockAndExport']);

const HELPER_NAME = 'assertContractorPaymentEligibility';
const DEFAULT_PAYMENT_ROUTER_PATH = resolve(
  process.cwd(),
  'packages/api/src/routers/finance/payment.ts',
);

export interface PaymentGateOffence {
  file: string;
  procedure: string;
  line: number;
}

export interface PaymentGateGuardOptions {
  paymentRouterPath?: string;
  /** Namespace the procedures are mounted under in root.ts. Default: 'payment'. */
  routerName?: string;
}

interface ProcedureBlock {
  name: string;
  startLine: number;
  body: string;
}

/**
 * Heuristic extraction (not a full parse) — fine for in-repo router files whose
 * shape is stable: each procedure is declared as `  <name>: <procedureBuilder>`
 * at the router-object base indentation (2-4 spaces) inside `router({ ... })`.
 * A new match ends the previous block; the block body accumulates every line
 * until the next procedure declaration (or EOF), which is sufficient to detect
 * whether the helper is called anywhere inside that procedure.
 */
function extractProcedures(source: string, routerName: string): ProcedureBlock[] {
  const lines = source.split(/\r?\n/);
  const blocks: ProcedureBlock[] = [];
  let current: ProcedureBlock | null = null;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i] ?? '';
    const m = ln.match(/^\s{2,4}(\w+):\s*(tenantProcedure|publicProcedure|protectedProcedure)\b/);
    if (m) {
      if (current) blocks.push(current);
      current = { name: `${routerName}.${m[1]}`, startLine: i + 1, body: ln };
    } else if (current) {
      current.body += `\n${ln}`;
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

/**
 * Returns one offence per payment-write procedure whose body does not call the
 * eligibility helper. Empty array = guard passes.
 */
export function runPaymentGateGuard(opts: PaymentGateGuardOptions = {}): PaymentGateOffence[] {
  const paymentRouterPath = opts.paymentRouterPath ?? DEFAULT_PAYMENT_ROUTER_PATH;
  const routerName = opts.routerName ?? 'payment';
  const offences: PaymentGateOffence[] = [];
  const src = readFileSync(paymentRouterPath, 'utf8');
  const blocks = extractProcedures(src, routerName);
  for (const block of blocks) {
    if (!PAYMENT_WRITE_PROCEDURES.has(block.name)) continue;
    if (!block.body.includes(`${HELPER_NAME}(`)) {
      offences.push({ file: paymentRouterPath, procedure: block.name, line: block.startLine });
    }
  }
  return offences;
}
