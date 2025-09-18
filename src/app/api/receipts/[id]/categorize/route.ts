import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { suggestCategory } from "@/lib/categorize";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    select: {
      id: true,
      merchantRaw: true,
      user: { select: { id: true, email: true } },
    },
  });
  if (!receipt) return new Response("Not found", { status: 404 });
  if (receipt.user.email !== session.user.email) return new Response("Forbidden", { status: 403 });

  const [items, rules] = await Promise.all([
    prisma.lineItem.findMany({
      where: { receiptId: id },
      select: { id: true, descriptionRaw: true, category: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.rule.findMany({
      where: { userId: receipt.user.id },
      select: { triggerType: true, triggerValue: true, actionCategory: true },
    }),
  ]);

  const updates = [];
  let applied = 0;

  for (const li of items) {
    const cat = suggestCategory(
      { descriptionRaw: li.descriptionRaw },
      receipt.merchantRaw ?? null,
      rules
    );
    if (cat && cat !== li.category) {
      applied++;
      updates.push(prisma.lineItem.update({ where: { id: li.id }, data: { category: cat } }));
    }
  }

  if (updates.length) await prisma.$transaction(updates);

  const refreshed = await prisma.lineItem.findMany({
    where: { receiptId: id },
    select: { id: true, category: true },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ applied, items: refreshed });
}
