import { describe, expect, it } from "vitest";
import {
  contractorCreateSchema,
  contractorLifecycleTransitionSchema,
  contractorListSchema,
  isValidNip,
  nipSchema,
} from "../contractor.js";

// ---------------------------------------------------------------------------
// isValidNip
// ---------------------------------------------------------------------------

describe("isValidNip", () => {
  it("returns true for a valid NIP", () => {
    expect(isValidNip("1234563218")).toBe(true);
  });

  it("returns false for an invalid NIP (wrong checksum)", () => {
    expect(isValidNip("1234563210")).toBe(false);
  });

  it("returns false for non-10-digit strings", () => {
    expect(isValidNip("12345")).toBe(false);
    expect(isValidNip("123456789012")).toBe(false);
    expect(isValidNip("abcdefghij")).toBe(false);
  });

  it("strips spaces and hyphens before validation", () => {
    expect(isValidNip("123 456 32 18")).toBe(true);
    expect(isValidNip("123-456-32-18")).toBe(true);
    expect(isValidNip("12-34 56-32 18")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// nipSchema
// ---------------------------------------------------------------------------

describe("nipSchema", () => {
  it("accepts a valid NIP", () => {
    const result = nipSchema.safeParse("1234563218");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("1234563218");
  });

  it("rejects an invalid NIP with correct error message", () => {
    const result = nipSchema.safeParse("1234563210");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Invalid NIP number");
    }
  });

  it("strips hyphens from valid NIP and returns clean digits", () => {
    const result = nipSchema.safeParse("123-456-32-18");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("1234563218");
    }
  });

  it("rejects NIP containing letters", () => {
    const result = nipSchema.safeParse("123ABC3218");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Invalid NIP number");
    }
  });

  it("rejects NIP with only 9 digits", () => {
    const result = nipSchema.safeParse("123456321");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Invalid NIP number");
    }
  });

  it("rejects NIP with 11 digits", () => {
    const result = nipSchema.safeParse("12345632180");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Invalid NIP number");
    }
  });
});

// ---------------------------------------------------------------------------
// contractorCreateSchema
// ---------------------------------------------------------------------------

describe("contractorCreateSchema", () => {
  const validInput = {
    legalName: "ACME Sp. z o.o.",
    displayName: "ACME",
    type: "COMPANY" as const,
    taxId: "1234563218",
    email: "contact@acme.pl",
    billingModel: "MONTHLY",
    rateValueMinor: 50000,
    ownerUserId: "usr_abc123",
    bankAccount: "PL61109010140000071219812874",
  };

  it("accepts valid complete input and applies defaults", () => {
    const result = contractorCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.taxId).toBe("1234563218");
      expect(result.data.countryCode).toBe("PL");
      expect(result.data.currency).toBe("PLN");
    }
  });

  it.each([
    "legalName",
    "displayName",
    "type",
    "taxId",
    "email",
    "billingModel",
    "rateValueMinor",
    "ownerUserId",
  ] as const)("rejects when required field '%s' is missing", (field) => {
    const input = { ...validInput };
    delete (input as Record<string, unknown>)[field];
    const result = contractorCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.flatMap((i) => i.path);
      expect(paths).toContain(field);
    }
  });

  it("rejects invalid email", () => {
    const result = contractorCreateSchema.safeParse({
      ...validInput,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path.includes("email"));
      expect(emailIssue).toBeDefined();
    }
  });

  it("rejects negative rateValueMinor", () => {
    const result = contractorCreateSchema.safeParse({
      ...validInput,
      rateValueMinor: -100,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("rateValueMinor"));
      expect(issue).toBeDefined();
    }
  });

  it("accepts a valid PL IBAN for bankAccount", () => {
    const result = contractorCreateSchema.safeParse({
      ...validInput,
      bankAccount: "PL61109010140000071219812874",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid IBAN for bankAccount", () => {
    const result = contractorCreateSchema.safeParse({
      ...validInput,
      bankAccount: "PL00000000000000000000000000",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("bankAccount"));
      expect(issue).toBeDefined();
      expect(issue?.message).toBe("Invalid IBAN number");
    }
  });

  it("accepts IBAN with spaces (spaces are stripped)", () => {
    const result = contractorCreateSchema.safeParse({
      ...validInput,
      bankAccount: "PL61 1090 1014 0000 0712 1981 2874",
    });
    // The IBAN refine strips spaces before validation, so this should pass
    expect(result.success).toBe(true);
  });

  it("transforms empty bankAccount string to undefined", () => {
    const result = contractorCreateSchema.safeParse({
      ...validInput,
      bankAccount: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bankAccount).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// contractorListSchema
// ---------------------------------------------------------------------------

describe("contractorListSchema", () => {
  it("applies defaults for page, pageSize, sortBy, sortOrder", () => {
    const result = contractorListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(25);
      expect(result.data.sortBy).toBe("created_at");
      expect(result.data.sortOrder).toBe("desc");
    }
  });

  it("accepts custom valid values", () => {
    const result = contractorListSchema.safeParse({
      page: 3,
      pageSize: 50,
      sortBy: "legal_name",
      sortOrder: "asc",
      search: "acme",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(50);
      expect(result.data.sortBy).toBe("legal_name");
      expect(result.data.sortOrder).toBe("asc");
    }
  });

  it("rejects page < 1", () => {
    const result = contractorListSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("page"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects pageSize > 50", () => {
    const result = contractorListSchema.safeParse({ pageSize: 51 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("pageSize"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects pageSize below minimum of 10", () => {
    const result = contractorListSchema.safeParse({ pageSize: 9 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("pageSize"));
      expect(issue).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// contractorLifecycleTransitionSchema
// ---------------------------------------------------------------------------

describe("contractorLifecycleTransitionSchema", () => {
  it("accepts a valid stage transition", () => {
    const result = contractorLifecycleTransitionSchema.safeParse({
      id: "ctr_123",
      stage: "ACTIVE",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid stage", () => {
    const result = contractorLifecycleTransitionSchema.safeParse({
      id: "ctr_123",
      stage: "INVALID_STAGE",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("stage"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects an empty id", () => {
    const result = contractorLifecycleTransitionSchema.safeParse({
      id: "",
      stage: "DRAFT",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("id"));
      expect(issue).toBeDefined();
    }
  });
});
