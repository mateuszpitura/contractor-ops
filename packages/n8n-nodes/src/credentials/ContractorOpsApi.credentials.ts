import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

import { buildAuthenticate, buildCredentialProperties, CREDENTIAL_TEST } from '../descriptions.js';
import { CONTRACTOR_OPS_DESCRIPTOR } from '../generated.js';

export class ContractorOpsApi implements ICredentialType {
  name = CONTRACTOR_OPS_DESCRIPTOR.credential.name;

  displayName = CONTRACTOR_OPS_DESCRIPTOR.credential.displayName;

  documentationUrl = 'https://developers.contractor-ops.com';

  properties: INodeProperties[] = buildCredentialProperties(CONTRACTOR_OPS_DESCRIPTOR);

  authenticate: IAuthenticateGeneric = buildAuthenticate(CONTRACTOR_OPS_DESCRIPTOR);

  test: ICredentialTestRequest = CREDENTIAL_TEST;
}
