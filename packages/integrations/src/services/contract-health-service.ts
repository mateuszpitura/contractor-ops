// Phase 75 D-13 — Anthropic IP-assignment evaluation service.
//
// Owns the Anthropic SDK call for the contract health check, mirroring
// ocr-service.extractInvoice. The api-package orchestrator
// (run-health-check.ts) calls this so the @anthropic-ai/sdk dependency stays
// inside @contractor-ops/integrations (the api package does not depend on it).

import Anthropic from '@anthropic-ai/sdk';
import type { ContractHealthToolInput } from '../adapters/contract-health-tools.js';
import {
  CONTRACT_HEALTH_PROMPT,
  CONTRACT_HEALTH_TOOL,
  CONTRACT_HEALTH_TOOL_NAME,
  contractHealthToolInputSchema,
} from '../adapters/contract-health-tools.js';

// Default to the same generally-available model the OCR adapter pins.
const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';

export interface EvaluateContractIpAssignmentParams {
  pdfBase64: string;
  /** Override the model (e.g., the CONTRACT_HEALTH_MODEL_VER pin from the api package). */
  modelId?: string;
  apiKey?: string;
}

/**
 * Sends the contract PDF to Claude with the evaluate_ip_assignment tool and
 * returns the structured tool_use input. Throws if no tool_use block is
 * returned (caller persists a FAILED run).
 */
export async function evaluateContractIpAssignment(
  params: EvaluateContractIpAssignmentParams,
): Promise<ContractHealthToolInput> {
  const client = new Anthropic({
    apiKey: params.apiKey ?? process.env.ANTHROPIC_API_KEY,
    timeout: 90_000,
    maxRetries: 1,
  });

  const response = await client.messages.create({
    model: params.modelId ?? DEFAULT_MODEL_ID,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: params.pdfBase64 },
          },
          { type: 'text', text: CONTRACT_HEALTH_PROMPT },
        ],
      },
    ],
    tools: [CONTRACT_HEALTH_TOOL],
    tool_choice: { type: 'tool', name: CONTRACT_HEALTH_TOOL_NAME },
  });

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  if (!toolUseBlock) {
    throw new Error('Claude returned no tool_use block for evaluate_ip_assignment');
  }
  return contractHealthToolInputSchema.parse(toolUseBlock.input) as ContractHealthToolInput;
}
