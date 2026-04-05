import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client/index.js";

/** Safe to unit-test without touching the module singleton `prisma`. */
export function createMissingDatabaseUrlProxy(): PrismaClient {
  return new Proxy(
    {},
    {
      get() {
        throw new Error("DATABASE_URL environment variable is not set");
      },
    },
  ) as PrismaClient;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  (process.env.DATABASE_URL ? createPrismaClient() : createMissingDatabaseUrlProxy());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
