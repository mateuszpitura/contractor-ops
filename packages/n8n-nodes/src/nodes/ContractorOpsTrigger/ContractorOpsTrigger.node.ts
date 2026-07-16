import type {
  IDataObject,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { buildTriggerProperties } from '../../descriptions.js';
import { CONTRACTOR_OPS_DESCRIPTOR } from '../../generated.js';

export class ContractorOpsTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: CONTRACTOR_OPS_DESCRIPTOR.trigger.displayName,
    name: CONTRACTOR_OPS_DESCRIPTOR.trigger.name,
    icon: 'fa:bell',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["events"].join(", ")}}',
    description: 'Starts a workflow when Contractor Ops emits a subscribed webhook event.',
    defaults: { name: 'Contractor Ops Trigger' },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: CONTRACTOR_OPS_DESCRIPTOR.credential.name, required: false }],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: buildTriggerProperties(CONTRACTOR_OPS_DESCRIPTOR),
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData() as IDataObject;
    const selectedEvents = (this.getNodeParameter('events', []) as string[]) ?? [];
    const eventType = typeof body.type === 'string' ? body.type : undefined;

    // A single Contractor Ops webhook endpoint may deliver every subscribed
    // event type, so forward only deliveries whose type the user selected on
    // this trigger — an empty selection forwards everything.
    if (
      selectedEvents.length > 0 &&
      (eventType === undefined || !selectedEvents.includes(eventType))
    ) {
      return { workflowData: [] };
    }

    return { workflowData: [this.helpers.returnJsonArray(body)] };
  }
}
