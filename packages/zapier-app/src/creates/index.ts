// Write actions, one per write operation in the OpenAPI snapshot.
//
// The action set (keys, nouns, labels, HTTP method + URL) comes from the
// generated Zapier definition, so every action resolves to a real public-API
// write operationId. The request body is a key/value passthrough until the
// generator emits per-operation field schemas from the OpenAPI request bodies.

import type { ZapierCreate } from '@contractor-ops/marketplace-manifests';
import type { Bundle, Create, ZObject } from 'zapier-platform-core';

import { toHttpMethod } from '../http-method.js';

/** The key the passthrough request body is collected under. */
const BODY_FIELD = 'fields';

function buildCreate(generated: ZapierCreate): Create {
  const { url } = generated.operation;
  const method = toHttpMethod(generated.operation.method);

  return {
    key: generated.key,
    noun: generated.noun,
    display: {
      label: generated.display.label,
      description: generated.display.description,
      hidden: generated.display.hidden,
    },
    operation: {
      inputFields: [
        {
          key: BODY_FIELD,
          label: `${generated.noun} fields`,
          dict: true,
          helpText:
            'Key/value pairs sent as the JSON request body. Field keys match the API request schema for this operation.',
        },
      ],
      perform: async (z: ZObject, bundle: Bundle) => {
        const body = (bundle.inputData[BODY_FIELD] as Record<string, unknown>) ?? {};
        const response = await z.request({ url, method, body });
        return response.data;
      },
      sample: { id: 'rec_sample' },
    },
  };
}

/** Build the keyed create map from the generated action list. */
export function buildCreates(generated: readonly ZapierCreate[]): Record<string, Create> {
  const creates: Record<string, Create> = {};
  for (const create of generated) {
    creates[create.key] = buildCreate(create);
  }
  return creates;
}
