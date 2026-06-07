// Add-on entitlement keys — single source of truth (FOUND7-01, D-01).
//
// Shared by the requireAddOn middleware, the grantAddOn mutation input
// (z.enum(ADD_ON_KEYS)), and the dev seed. Lowercase wire keys (no Prisma enum):
// a 2-value set does not justify the UPPER_SNAKE_CASE + display-map ceremony the
// db:audit-enum-casing gate would force. The Subscription.addOns String[] element
// type IS this wire key end-to-end (DB, error JSON, seed).

export const ADD_ON_KEYS = ['workforce', 'us-cross-border'] as const;
export type AddOnKey = (typeof ADD_ON_KEYS)[number];
