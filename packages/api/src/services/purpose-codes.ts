/**
 * ISO 20022 ExternalPurpose1Code mapping for SWIFT payment purpose codes.
 * Per D-04: auto-assigned from contract service category, manually overridable.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PurposeCodeEntry {
  code: string;
  description: string;
  serviceCategories: string[];
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Mapping of service categories to ISO 20022 purpose codes.
 * Keys in serviceCategories are normalized uppercase with underscores.
 */
const PURPOSE_CODE_MAP: PurposeCodeEntry[] = [
  {
    code: "SCVE",
    description: "Services",
    serviceCategories: [
      "SOFTWARE_DEVELOPMENT",
      "SOFTWARE",
      "ENGINEERING",
      "IT_SERVICES",
      "DEVELOPMENT",
    ],
  },
  {
    code: "COMC",
    description: "Commercial",
    serviceCategories: [
      "CONSULTING",
      "ADVISORY",
      "MANAGEMENT_CONSULTING",
      "STRATEGY",
    ],
  },
  {
    code: "LGAS",
    description: "Legal Services",
    serviceCategories: ["LEGAL", "COMPLIANCE", "REGULATORY"],
  },
  {
    code: "ACCT",
    description: "Account Management",
    serviceCategories: [
      "ACCOUNTING",
      "BOOKKEEPING",
      "AUDIT",
      "FINANCE",
      "TAX",
    ],
  },
  {
    code: "ADVE",
    description: "Advertising",
    serviceCategories: [
      "MARKETING",
      "ADVERTISING",
      "PR",
      "COMMUNICATIONS",
      "MEDIA",
    ],
  },
  {
    code: "EDUC",
    description: "Education",
    serviceCategories: ["EDUCATION", "TRAINING", "COACHING", "MENTORING"],
  },
  {
    code: "BLDG",
    description: "Building Maintenance",
    serviceCategories: [
      "CONSTRUCTION",
      "FACILITIES",
      "MAINTENANCE",
      "REAL_ESTATE",
    ],
  },
  {
    code: "OTHR",
    description: "Other",
    serviceCategories: [
      "DESIGN",
      "CREATIVE",
      "GRAPHIC_DESIGN",
      "UX",
      "UI",
    ],
  },
  {
    code: "SUPP",
    description: "Supplier Payment",
    serviceCategories: [], // Default fallback — no specific categories
  },
];

const DEFAULT_PURPOSE_CODE = "SUPP";

// Build reverse lookup: category -> code
const CATEGORY_TO_CODE = new Map<string, string>();
for (const entry of PURPOSE_CODE_MAP) {
  for (const cat of entry.serviceCategories) {
    CATEGORY_TO_CODE.set(cat, entry.code);
  }
}

// Valid purpose codes set
const VALID_CODES = new Set(PURPOSE_CODE_MAP.map((e) => e.code));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the ISO 20022 purpose code for a service category.
 * If override is provided and valid, returns the override value.
 * Falls back to "SUPP" for unknown categories.
 */
export function getPurposeCode(
  serviceCategory: string,
  override?: string | null,
): string {
  if (override && VALID_CODES.has(override)) {
    return override;
  }
  const normalized = serviceCategory.toUpperCase().replace(/[\s-]/g, "_");
  return CATEGORY_TO_CODE.get(normalized) ?? DEFAULT_PURPOSE_CODE;
}

/**
 * Validate a purpose code string.
 */
export function isValidPurposeCode(code: string): boolean {
  return VALID_CODES.has(code);
}

/**
 * Get all available purpose codes with descriptions.
 */
export function getAllPurposeCodes(): PurposeCodeEntry[] {
  return PURPOSE_CODE_MAP;
}
