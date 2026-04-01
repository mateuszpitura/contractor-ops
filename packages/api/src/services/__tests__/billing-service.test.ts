import { describe, it, expect } from "vitest";

describe("billing-service", () => {
  describe("tier management (BILL-01)", () => {
    it.todo(
      "createCheckoutSession creates a Stripe session with STARTER price",
    );
    it.todo("createCheckoutSession creates a Stripe session with PRO price");
    it.todo(
      "createCheckoutSession creates a Stripe session with ENTERPRISE price",
    );
    it.todo("createCheckoutSession sets currency to PLN");
    it.todo(
      "createCheckoutSession includes organizationId in subscription_data.metadata",
    );
  });

  describe("trial (BILL-03)", () => {
    it.todo(
      "createCheckoutSession includes trial_period_days: 14 for new org (isNewOrg=true)",
    );
    it.todo(
      "createCheckoutSession omits trial_period_days for existing org (isNewOrg=false)",
    );
  });

  describe("proration (BILL-02)", () => {
    it.todo(
      "getProrationPreview returns line items with description and amountGrosze",
    );
    it.todo("getProrationPreview returns totalGrosze");
    it.todo("getProrationPreview throws for invalid subscription ID");
  });

  describe("portal (BILL-08)", () => {
    it.todo("createPortalSession returns a URL");
    it.todo("createPortalSession passes stripeCustomerId and returnUrl");
  });

  describe("ensureStripeCustomer", () => {
    it.todo(
      "returns existing stripeCustomerId if subscription already exists",
    );
    it.todo(
      "creates a new Stripe customer if no subscription exists for the org",
    );
    it.todo(
      "includes organizationId in customer metadata when creating new customer",
    );
  });

  describe("input validation", () => {
    it.todo("createCheckoutSession throws for empty organizationId");
    it.todo("createCheckoutSession throws for empty priceId");
    it.todo("getProrationPreview throws for empty stripeSubscriptionId");
    it.todo("createPortalSession throws for empty stripeCustomerId");
    it.todo("ensureStripeCustomer throws for empty email");
  });
});
