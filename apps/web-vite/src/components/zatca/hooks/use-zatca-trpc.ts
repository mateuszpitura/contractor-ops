import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ZatcaTrpcProxy } from '../zatca-trpc.js';

export function useZatcaTrpc(): ZatcaTrpcProxy {
  const trpc = useTRPC();
  return (trpc as unknown as Record<string, unknown>).zatca as ZatcaTrpcProxy;
}
