// Anthropic tool_use schema for the contract health check.
// The schema lives next to ClaudeOcrAdapter (the shared OCR client) — the
// contract health service imports the tool definition AND the adapter, then
// composes them with the contract PDF to perform the IP-assignment check.

import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

export const CONTRACT_HEALTH_TOOL_NAME = 'evaluate_ip_assignment' as const;

export const CONTRACT_HEALTH_PROMPT = `You are a contract review assistant evaluating whether a contract contains intellectual-property (IP) assignment / Nutzungsrechte language.

Goals:
1. Determine the verdict: LIKELY_PRESENT | LIKELY_MISSING | MANUAL_REVIEW_REQUIRED
2. Cite the SPECIFIC clause text from the contract that supports your verdict (verbatim quote — do NOT paraphrase)
3. Identify the jurisdiction implied by each cited clause (UK, DE, PL, US, KSA, UAE)
4. Provide a per-clause confidence score from 0.0 to 1.0

Notes for jurisdiction-aware reasoning:
- UK / US / PL / KSA / UAE — accept "hereby assigns" / "transfer of rights" patterns that grant IP to the customer
- DE — Werkvertrag law (UrhG §7 Schöpferprinzip) makes authorship inalienable; only Nutzungsrechte (usage rights, §31 UrhG) can be granted. UK-style "hereby assigns" boilerplate is INSUFFICIENT under DE law.
- If the contract appears to mix jurisdictions or use insufficient language for the declared jurisdiction, return MANUAL_REVIEW_REQUIRED.

Return your verdict via the evaluate_ip_assignment tool. Cite text verbatim from the document.`;

export const CONTRACT_HEALTH_TOOL: Anthropic.Tool = {
  name: CONTRACT_HEALTH_TOOL_NAME,
  description:
    'Evaluate whether a contract contains IP-assignment language; return verdict + cited clauses with jurisdiction + confidence.',
  input_schema: {
    type: 'object',
    properties: {
      verdict: {
        type: 'string',
        enum: ['LIKELY_PRESENT', 'LIKELY_MISSING', 'MANUAL_REVIEW_REQUIRED'],
        description: 'Tristate verdict for IP-assignment presence.',
      },
      citedClauses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            citedText: {
              type: 'string',
              description:
                'Verbatim quote from the contract text supporting the verdict. Empty array if verdict is LIKELY_MISSING.',
            },
            jurisdiction: {
              type: 'string',
              enum: ['UK', 'DE', 'PL', 'US', 'KSA', 'UAE'],
              description:
                'Jurisdiction implied by the cited clause (e.g., language indicating UrhG = DE).',
            },
            confidence: {
              type: 'number',
              description: 'Confidence in this clause supporting the verdict, 0.0-1.0.',
            },
          },
          required: ['citedText', 'jurisdiction', 'confidence'],
        },
      },
      reasoning: {
        type: 'string',
        description: 'One-paragraph explanation of the verdict — useful for audit trail. Optional.',
      },
    },
    required: ['verdict', 'citedClauses'],
  },
};

/**
 * Zod schema mirroring ContractHealthToolInput — validates the raw
 * toolUseBlock.input from Anthropic before the caller trusts any field.
 * Fails closed: a malformed/drifted model response throws ZodError so the
 * run-health-check orchestrator can record MANUAL_REVIEW_REQUIRED instead
 * of silently coercing garbage into the results store.
 */
export const contractHealthToolInputSchema = z.object({
  verdict: z.enum(['LIKELY_PRESENT', 'LIKELY_MISSING', 'MANUAL_REVIEW_REQUIRED']),
  citedClauses: z.array(
    z.object({
      citedText: z.string(),
      jurisdiction: z.enum(['UK', 'DE', 'PL', 'US', 'KSA', 'UAE']),
      confidence: z.number().min(0).max(1),
    }),
  ),
  reasoning: z.string().optional(),
});

export interface ContractHealthToolInput {
  verdict: 'LIKELY_PRESENT' | 'LIKELY_MISSING' | 'MANUAL_REVIEW_REQUIRED';
  citedClauses: Array<{
    citedText: string;
    jurisdiction: 'UK' | 'DE' | 'PL' | 'US' | 'KSA' | 'UAE';
    confidence: number;
  }>;
  reasoning?: string;
}
