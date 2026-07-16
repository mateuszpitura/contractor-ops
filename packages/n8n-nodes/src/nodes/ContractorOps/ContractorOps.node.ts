import type {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestMethods,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { buildNodeProperties } from '../../descriptions.js';
import { CONTRACTOR_OPS_DESCRIPTOR, operationByValue } from '../../generated.js';

const CREDENTIAL_NAME = CONTRACTOR_OPS_DESCRIPTOR.credential.name;

function asObject(value: unknown): IDataObject {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return {};
    return JSON.parse(trimmed) as IDataObject;
  }
  return (value as IDataObject | null) ?? {};
}

/** Resolve one input item to a request and send it through the authenticated helper. */
async function runOperation(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
  const operationValue = ctx.getNodeParameter('operation', itemIndex) as string;
  const op = operationByValue(CONTRACTOR_OPS_DESCRIPTOR, operationValue);
  if (!op) {
    throw new NodeOperationError(ctx.getNode(), `Unknown operation: ${operationValue}`, {
      itemIndex,
    });
  }

  const credentials = await ctx.getCredentials(CREDENTIAL_NAME);
  const baseURL =
    (credentials.baseUrl as string | undefined) ?? CONTRACTOR_OPS_DESCRIPTOR.node.baseUrl;

  const pathParameters = asObject(ctx.getNodeParameter('pathParameters', itemIndex, {}));
  const url = op.path.replace(/\{(\w+)\}/g, (_match, key: string) =>
    encodeURIComponent(String(pathParameters[key] ?? '')),
  );

  const body = asObject(ctx.getNodeParameter('body', itemIndex, {}));
  const hasBody = Object.keys(body).length > 0;

  return (await ctx.helpers.httpRequestWithAuthentication.call(ctx, CREDENTIAL_NAME, {
    baseURL,
    url,
    method: op.method as IHttpRequestMethods,
    body: hasBody ? body : undefined,
    json: true,
  })) as IDataObject;
}

export class ContractorOps implements INodeType {
  description: INodeTypeDescription = {
    displayName: CONTRACTOR_OPS_DESCRIPTOR.node.displayName,
    name: CONTRACTOR_OPS_DESCRIPTOR.node.name,
    icon: 'fa:briefcase',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description:
      'Perform Contractor Ops write operations (contractors, invoices, payments, workflows) through the public REST API.',
    defaults: { name: 'Contractor Ops' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: CREDENTIAL_NAME, required: true }],
    properties: buildNodeProperties(CONTRACTOR_OPS_DESCRIPTOR),
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const response = await runOperation(this, i);
        returnData.push({ json: response ?? {}, pairedItem: { item: i } });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: error instanceof Error ? error.message : String(error) },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
