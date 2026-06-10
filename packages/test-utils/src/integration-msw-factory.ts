/**
 * Factory for integration MSW handler registration — reduces per-provider boilerplate.
 */
import { selectHandlers } from './msw/handlers/index.js';
import type { ProviderName } from './msw/handlers/index.js';
import type { HandlerOptions } from './msw/types.js';

export type IntegrationMswProviderConfig = {
  providers: ProviderName[];
  options?: HandlerOptions;
};

export function createIntegrationMswHandlers(
  config: IntegrationMswProviderConfig | ProviderName[],
) {
  const providers = Array.isArray(config) ? config : config.providers;
  const options = Array.isArray(config) ? undefined : config.options;
  return selectHandlers(providers, options);
}

export type { HandlerOptions, ProviderName };
