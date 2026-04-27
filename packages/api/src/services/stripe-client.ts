import { getServerEnv } from '@contractor-ops/validators';
import Stripe from 'stripe';

export const stripe = new Stripe(getServerEnv().STRIPE_SECRET_KEY, {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
});
