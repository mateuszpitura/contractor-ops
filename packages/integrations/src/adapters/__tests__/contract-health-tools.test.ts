import { describe, expect, it } from 'vitest';
import {
  CONTRACT_HEALTH_PROMPT,
  CONTRACT_HEALTH_TOOL,
  CONTRACT_HEALTH_TOOL_NAME,
} from '../contract-health-tools.js';

type SchemaProps = {
  properties: Record<
    string,
    { enum?: string[]; items?: { properties: Record<string, { enum?: string[]; type?: string }> } }
  >;
  required: string[];
};
const schema = CONTRACT_HEALTH_TOOL.input_schema as unknown as SchemaProps;

describe('contract-health-tools tool_use schema (Phase 75 D-13)', () => {
  it('exports CONTRACT_HEALTH_TOOL with name evaluate_ip_assignment', () => {
    expect(CONTRACT_HEALTH_TOOL.name).toBe('evaluate_ip_assignment');
    expect(CONTRACT_HEALTH_TOOL_NAME).toBe('evaluate_ip_assignment');
  });

  it('input_schema covers verdict + citedClauses[] per D-06', () => {
    expect(schema.properties).toHaveProperty('verdict');
    expect(schema.properties).toHaveProperty('citedClauses');
  });

  it('verdict enum includes the 3 D-06 values', () => {
    expect(schema.properties.verdict?.enum).toEqual([
      'LIKELY_PRESENT',
      'LIKELY_MISSING',
      'MANUAL_REVIEW_REQUIRED',
    ]);
  });

  it('citedClauses items declare jurisdiction enum (UK, DE, PL, US, KSA, UAE)', () => {
    const items = schema.properties.citedClauses?.items;
    expect(items?.properties.jurisdiction?.enum).toEqual(['UK', 'DE', 'PL', 'US', 'KSA', 'UAE']);
  });

  it('CONTRACT_HEALTH_PROMPT mentions DE Werkvertrag + UrhG + Schöpferprinzip + INSUFFICIENT', () => {
    expect(CONTRACT_HEALTH_PROMPT).toMatch(/Werkvertrag/);
    expect(CONTRACT_HEALTH_PROMPT).toMatch(/UrhG/);
    expect(CONTRACT_HEALTH_PROMPT).toMatch(/Sch[öo]pferprinzip/);
    expect(CONTRACT_HEALTH_PROMPT).toMatch(/INSUFFICIENT/);
  });

  it('required fields are verdict + citedClauses', () => {
    expect(schema.required).toContain('verdict');
    expect(schema.required).toContain('citedClauses');
  });

  it('confidence field has type: number per D-06', () => {
    const confidence = schema.properties.citedClauses?.items?.properties.confidence;
    expect(confidence?.type).toBe('number');
  });
});
