/**
 * Webhook plugin — registers every external-provider signed-webhook
 * route under a single encapsulated plugin scope.
 *
 * Encapsulation matters because every webhook needs the raw request
 * body (HMAC signature verification needs the exact bytes the upstream
 * signed over). Overriding the content-type parser here keeps that
 * override scoped — tRPC + auth + JSON utility routes registered at
 * the parent scope retain Fastify's default parsing.
 *
 * Step 5 currently ships Stripe as the proof-of-pattern. Each
 * remaining provider follows the same shape:
 *   1. Verify signature with the provider's SDK / HMAC helper.
 *   2. Idempotency check against the provider-specific event table.
 *   3. Process the event inside the same Serializable tx that wrote
 *      the idempotency row.
 *   4. Dispatch notifications AFTER tx commit.
 *   5. Forward 5xx errors to Sentry; metrics.increment for processed /
 *      failed / late_delivery counters.
 *
 * Follow-up routes to port:
 *   - /webhooks/storecove   (Peppol BIS via Storecove)
 *   - /webhooks/inpost      (shipment status)
 *   - /webhooks/[provider]  (slack, resend, linear, jira, notion,
 *                            confluence, docusign, autenti)
 *   - /webhooks/_process    (QStash drain)
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { registerContractHealthRoute } from '../contract-health.js';
import { registerExportsProcessRoute } from '../exports.js';
import { registerGoogleWorkspaceSyncRoute } from '../google-workspace.js';
import { registerIdpDeprovisioningStepRunnerRoute } from '../idp-deprovisioning.js';
import { registerKsefSyncRoute } from '../ksef.js';
import { registerLateInterestRenderRoute } from '../late-interest.js';
import { registerOcrProcessRoute } from '../ocr.js';
import { registerOutboxDrainRoute } from '../outbox.js';
import {
  registerPeppolInboundRoute,
  registerPeppolOutboundRoute,
  registerPeppolPollRoute,
} from '../peppol.js';
import { registerRevalidateLegalRoute } from '../revalidate-legal.js';
import { registerZatcaSubmitRoute } from '../zatca.js';
import { registerInPostWebhookRoute } from './inpost.js';
import { registerMultiProviderWebhookRoute } from './multi-provider.js';
import { registerProcessWebhookRoute } from './process.js';
import { registerStorecoveWebhookRoute } from './storecove.js';
import { registerStripeWebhookRoute } from './stripe.js';

const webhookPluginImpl: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Raw-body parser — HMAC signature verification needs the exact bytes.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  // Explicit per-provider routes register before the parametric
  // dispatcher — Fastify's router prefers static paths over parametric
  // when both match, but registration order is the documented disambig
  // for any edge case.
  registerStripeWebhookRoute(app);
  registerInPostWebhookRoute(app);
  registerStorecoveWebhookRoute(app);
  // QStash drain — static path `/webhooks/_process`; register before the
  // parametric `:provider` route below so the static match wins.
  registerProcessWebhookRoute(app);
  // Parametric `/webhooks/:provider` dispatcher for adapter-driven
  // providers (slack/resend/linear/jira/notion/docusign/autenti/...).
  registerMultiProviderWebhookRoute(app);
  // /revalidate-legal isn't under /webhooks/* but uses HMAC verification
  // and needs the raw body — easiest scope match is here.
  registerRevalidateLegalRoute(app);
  // QStash-driven worker routes outside /webhooks/* — same raw-body
  // requirement (Receiver HMAC is computed over the exact bytes), so
  // they live inside the webhook plugin scope.
  registerZatcaSubmitRoute(app);
  registerPeppolPollRoute(app);
  registerPeppolInboundRoute(app);
  registerPeppolOutboundRoute(app);
  registerKsefSyncRoute(app);
  registerOutboxDrainRoute(app);
  registerOcrProcessRoute(app);
  registerExportsProcessRoute(app);
  registerGoogleWorkspaceSyncRoute(app);
  registerLateInterestRenderRoute(app);
  // Contract health-check QStash callback.
  registerContractHealthRoute(app);
  // IdP deprovisioning saga step runner.
  registerIdpDeprovisioningStepRunnerRoute(app);
};

export const webhookPlugin = webhookPluginImpl;
