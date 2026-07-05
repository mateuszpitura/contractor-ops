import { getServerEnv } from '@contractor-ops/validators';
import Stripe from 'stripe';

let client: Stripe | undefined;

// Instantiate lazily on first use. Constructing at module load would call
// getServerEnv() (and its full env validation) merely by importing this file
// transitively via the appRouter, so one unrelated missing env var would brick
// every import chain that touches Stripe. The Proxy keeps the `stripe.<resource>`
// call surface identical for callers.
function getStripeClient(): Stripe {
  client ??= new Stripe(getServerEnv().STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
  });
  return client;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripeClient(), prop, receiver);
  },
});
