// ---------------------------------------------------------------------------
// E-Invoice Engine
// ---------------------------------------------------------------------------

import { getProfile, listProfiles } from "../registry.js";
import type { ComplianceStatus } from "../types/compliance.js";
import type { EInvoice } from "../types/invoice.js";
import type { ValidationResult } from "../types/validation.js";

/**
 * E-Invoice Engine — orchestrates country profiles for invoice operations.
 *
 * The engine delegates all country-specific logic to registered profiles.
 * It never contains country-specific code itself.
 */
export class EInvoiceEngine {
  /**
   * Generate country-specific XML from a canonical EInvoice.
   */
  async generate(profileId: string, invoice: EInvoice): Promise<string> {
    const profile = getProfile(profileId);
    return profile.generate(invoice);
  }

  /**
   * Parse country-specific XML into a canonical EInvoice.
   */
  async parse(
    profileId: string,
    xml: string,
    metadata?: Record<string, unknown>,
  ): Promise<EInvoice> {
    const profile = getProfile(profileId);
    return profile.parse(xml, metadata);
  }

  /**
   * Validate XML against a country profile's rules.
   */
  async validate(profileId: string, xml: string): Promise<ValidationResult> {
    const profile = getProfile(profileId);
    return profile.validate(xml);
  }

  /**
   * Get compliance status for a single profile within an organization.
   */
  async getComplianceStatus(profileId: string, organizationId: string): Promise<ComplianceStatus> {
    const profile = getProfile(profileId);
    return profile.getComplianceStatus(organizationId);
  }

  /**
   * Get compliance statuses for all registered profiles within an organization.
   */
  async getComplianceStatuses(organizationId: string): Promise<ComplianceStatus[]> {
    const profiles = listProfiles();
    return Promise.all(profiles.map((p) => p.getComplianceStatus(organizationId)));
  }
}
