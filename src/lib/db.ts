// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"], // keep logs minimal; add "query" if debugging
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
