import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return new Response("Unauthorized", { status: 401 });

  const receipt = await prisma.receipt.findFirst({
    where: {
      id,
      OR: [
        { user: { email } },
        { group: { members: { some: { user: { email }, status: "ACTIVE" } } } },
      ],
    },
    select: {
      id: true,
      groupId: true,
      merchantRaw: true,
      merchantNormalized: true,
      purchaseDate: true,
      subtotal: true,
      tax: true,
      tip: true,
      total: true,
      imageUrl: true,
      // lightweight group info for Split page
      group: {
        select: {
          id: true,
          name: true,
          members: {
            select: {
              user: { select: { id: true, name: true, email: true } },
              role: true,
              status: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      lineItems: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          descriptionRaw: true,
          qty: true,
          unitPrice: true,
          lineTotal: true,
          category: true,
        },
      },
    },
  });

  if (!receipt) return new Response("Not found", { status: 404 });
  return Response.json(receipt);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return new Response("Unauthorized", { status: 401 });

    // authorize: owner or active group member
    const canEdit = await prisma.receipt.findFirst({
      where: {
        id,
        OR: [
          { user: { email } },
          { group: { members: { some: { user: { email }, status: "ACTIVE" } } } },
        ],
      },
      select: { id: true },
    });
    if (!canEdit) return new Response("Forbidden", { status: 403 });

    const body = await req.json();
    const { merchantNormalized, purchaseDate, totals, items } = body as {
      merchantNormalized?: string;
      purchaseDate?: string;
      totals?: { subtotal?: number; tax?: number; tip?: number; total?: number };
      items: Array<{
        id: string;
        descriptionRaw?: string;
        qty?: number;
        unitPrice?: number | null;
        lineTotal?: number | null;
        category?: string | null;
      }>;
    };

    const tx: any[] = [];
    tx.push(
      prisma.receipt.update({
        where: { id },
        data: {
          merchantNormalized: merchantNormalized ?? undefined,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
          subtotal:
            totals?.subtotal !== undefined
              ? new Prisma.Decimal(totals.subtotal.toFixed(2))
              : undefined,
          tax:
            totals?.tax !== undefined
              ? new Prisma.Decimal(totals.tax.toFixed(2))
              : undefined,
          tip:
            totals?.tip !== undefined
              ? new Prisma.Decimal(totals.tip.toFixed(2))
              : undefined,
          total:
            totals?.total !== undefined
              ? new Prisma.Decimal(totals.total.toFixed(2))
              : undefined,
        },
      })
    );

    for (const it of items || []) {
      tx.push(
        prisma.lineItem.update({
          where: { id: it.id },
          data: {
            descriptionRaw: it.descriptionRaw ?? null,
            qty: it.qty ?? 1,
            unitPrice:
              it.unitPrice !== undefined && it.unitPrice !== null
                ? new Prisma.Decimal(it.unitPrice.toFixed(2))
                : null,
            lineTotal:
              it.lineTotal !== undefined && it.lineTotal !== null
                ? new Prisma.Decimal(it.lineTotal.toFixed(2))
                : null,
            category: it.category as any,
          },
        })
      );
    }

    await prisma.$transaction(tx);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[RECEIPT_PUT_ERROR]", e);
    return new Response("Failed to update receipt", { status: 500 });
  }
}
