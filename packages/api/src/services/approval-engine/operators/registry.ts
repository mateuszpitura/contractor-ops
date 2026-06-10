// Plug-in operator registry for approval-engine conditions.
//
// A Map-backed registry that lets approval-engine condition operators
// self-register at module-load via barrel-import side effects in
// operators/index.ts. Currently ships ONE operator (complianceCritical);
// future operators (budget-cap, fraud-score) plug in without core-engine edits.

import type { PrismaClient } from '@contractor-ops/db';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export interface OperatorContext {
  tx: TxClient;
  contractorId: string;
  organizationId: string;
}

export type ConditionEvaluator<TArgs = unknown> = (
  args: TArgs,
  ctx: OperatorContext,
) => Promise<boolean>;

const operators = new Map<string, ConditionEvaluator>();

export function registerOperator<TArgs>(name: string, evaluator: ConditionEvaluator<TArgs>): void {
  if (operators.has(name)) throw new Error(`Operator already registered: ${name}`);
  operators.set(name, evaluator as ConditionEvaluator);
}

export async function evaluateOperator(
  name: string,
  args: unknown,
  ctx: OperatorContext,
): Promise<boolean> {
  const evaluator = operators.get(name);
  if (!evaluator) throw new Error(`Unknown operator: ${name}`);
  return evaluator(args, ctx);
}

export function getRegisteredOperators(): string[] {
  return Array.from(operators.keys());
}

// Test-only: clear the registry between tests when needed.
// biome-ignore lint/style/useNamingConvention: test-internals export uses double-underscore prefix
export const __testOnly = {
  reset(): void {
    operators.clear();
  },
};
