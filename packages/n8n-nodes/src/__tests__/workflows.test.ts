/**
 * The three shipped example workflows must be valid n8n exports AND stay
 * consistent with the package: every Contractor Ops node references this
 * package's node types, and every trigger subscribes only to events that exist
 * in the real webhook catalog — so an example can never drift from the nodes it
 * demonstrates.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WEBHOOK_EVENT_TYPES } from '@contractor-ops/validators';
import { describe, expect, it } from 'vitest';

import { CONTRACTOR_OPS_DESCRIPTOR } from '../generated';

const WORKFLOWS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'workflows');
const PACKAGE = '@contractor-ops/n8n-nodes';
const NODE_TYPE = `${PACKAGE}.${CONTRACTOR_OPS_DESCRIPTOR.node.name}`;
const TRIGGER_TYPE = `${PACKAGE}.${CONTRACTOR_OPS_DESCRIPTOR.trigger.name}`;

interface WorkflowNode {
  name: string;
  type: string;
  parameters?: Record<string, unknown>;
}

interface Workflow {
  name: string;
  nodes: WorkflowNode[];
  connections: Record<string, unknown>;
  active: boolean;
}

function loadWorkflow(file: string): Workflow {
  return JSON.parse(readFileSync(join(WORKFLOWS_DIR, `${file}.json`), 'utf8')) as Workflow;
}

const WORKFLOW_FILES = [
  'invoice-to-slack',
  'contractor-onboard-from-personio',
  'compliance-expiry-to-pagerduty',
] as const;

describe.each(WORKFLOW_FILES)('example workflow %s', file => {
  const workflow = loadWorkflow(file);

  it('is a valid n8n workflow export (nodes + connections + inactive)', () => {
    expect(typeof workflow.name).toBe('string');
    expect(Array.isArray(workflow.nodes)).toBe(true);
    expect(workflow.nodes.length).toBeGreaterThanOrEqual(2);
    expect(typeof workflow.connections).toBe('object');
    expect(workflow.active).toBe(false);
  });

  it('references at least one Contractor Ops node type from this package', () => {
    const coNodes = workflow.nodes.filter(n => n.type === NODE_TYPE || n.type === TRIGGER_TYPE);
    expect(coNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('every trigger subscribes only to real webhook catalog events', () => {
    const triggers = workflow.nodes.filter(n => n.type === TRIGGER_TYPE);
    for (const trigger of triggers) {
      const events = (trigger.parameters?.events ?? []) as string[];
      expect(events.length).toBeGreaterThan(0);
      for (const event of events) {
        expect(WEBHOOK_EVENT_TYPES).toContain(event);
      }
    }
  });
});

describe('workflow catalog coverage', () => {
  it('the onboarding recipe drives a Contractor Ops write action', () => {
    const workflow = loadWorkflow('contractor-onboard-from-personio');
    const writeNode = workflow.nodes.find(n => n.type === NODE_TYPE);
    expect(writeNode?.parameters?.operation).toBe('createContractor');
  });

  it('the two trigger recipes cover the invoice and compliance event families', () => {
    const invoice = loadWorkflow('invoice-to-slack');
    const compliance = loadWorkflow('compliance-expiry-to-pagerduty');
    const invoiceEvents = (invoice.nodes.find(n => n.type === TRIGGER_TYPE)?.parameters?.events ??
      []) as string[];
    const complianceEvents = (compliance.nodes.find(n => n.type === TRIGGER_TYPE)?.parameters
      ?.events ?? []) as string[];
    expect(invoiceEvents.every(e => e.startsWith('invoice.'))).toBe(true);
    expect(complianceEvents.every(e => e.startsWith('compliance_doc.'))).toBe(true);
  });
});
