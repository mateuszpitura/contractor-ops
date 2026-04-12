import type { PrismaClient as BasePrismaClient } from "@contractor-ops/db";

/**
 * Database client type used across services.
 *
 * Covers both the root PrismaClient and Prisma interactive transaction
 * clients (`prisma.$transaction(async (tx) => ...)`), which share the
 * same query interface but have different runtime types.
 *
 * Using the full PrismaClient type here because Prisma's TransactionClient
 * is a subset — functions accepting DbClient work with either.
 */
export type DbClient = BasePrismaClient;
