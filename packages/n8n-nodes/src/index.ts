// @contractor-ops/n8n-nodes — the n8n community node package.
//
// n8n loads the nodes + credential from the compiled `dist/` paths declared in
// the `n8n` block of package.json; this index re-exports them for programmatic
// consumers and keeps the generated descriptor + builders on the public surface.

export { ContractorOpsApi } from './credentials/ContractorOpsApi.credentials.js';
export {
  buildAuthenticate,
  buildCredentialProperties,
  buildNodeProperties,
  buildTriggerProperties,
  CREDENTIAL_TEST,
  eventDisplayName,
} from './descriptions.js';
export {
  buildDescriptor,
  CONTRACTOR_OPS_DESCRIPTOR,
  loadSnapshot,
  type N8nOperation,
  operationByValue,
} from './generated.js';
export { ContractorOps } from './nodes/ContractorOps/ContractorOps.node.js';
export { ContractorOpsTrigger } from './nodes/ContractorOpsTrigger/ContractorOpsTrigger.node.js';
