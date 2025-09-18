// src/app/api/health/db/route.ts
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [users, receipts, lineItems] = await Promise.all([
      prisma.user.count(),
      prisma.receipt.count(),
      prisma.lineItem.count(),
    ]);

    return Response.json({ ok: true, users, receipts, lineItems });
  } catch (err) {
    console.error("[DB_HEALTH_ERROR]", err);
    return new Response("DB error", { status: 500 });
  }
}
