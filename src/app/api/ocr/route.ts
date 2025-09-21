import { AnalyzeExpenseCommand, TextractClient } from "@aws-sdk/client-textract";
import { prisma } from "@/lib/db";
import { parseAnalyzeExpense } from "@/lib/parseTextract";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
const REGION = process.env.AWS_REGION!;
const BUCKET = process.env.S3_BUCKET!;
const textract = new TextractClient({ region: REGION });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { receiptId, debug } = body || {};
    if (!receiptId) return new Response("Missing receiptId", { status: 400 });

    const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!receipt?.imageUrl) return new Response("Receipt or S3 key not found", { status: 404 });

    const key = receipt.imageUrl; // we stored the S3 key in imageUrl

    const resp = await textract.send(new AnalyzeExpenseCommand({
      Document: { S3Object: { Bucket: BUCKET, Name: key } },
    }));

    const parsed = parseAnalyzeExpense(resp);

    // Store raw JSON & top-level fields
    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        ocrJson: resp as any,
        merchantRaw: parsed.merchantRaw ?? receipt.merchantRaw,
        purchaseDate: parsed.purchaseDate ? new Date(parsed.purchaseDate) : receipt.purchaseDate,
        subtotal: parsed.subtotal != null ? new Prisma.Decimal(parsed.subtotal.toFixed(2)) : receipt.subtotal,
        tax: parsed.tax != null ? new Prisma.Decimal(parsed.tax.toFixed(2)) : receipt.tax,
        tip: parsed.tip != null ? new Prisma.Decimal(parsed.tip.toFixed(2)) : receipt.tip,
        total: parsed.total != null ? new Prisma.Decimal(parsed.total.toFixed(2)) : receipt.total,
      },
    });

    // Replace line items
    await prisma.lineItem.deleteMany({ where: { receiptId } });
    if (parsed.lineItems.length) {
      await prisma.lineItem.createMany({
        data: parsed.lineItems.map((li) => ({
          receiptId,
          descriptionRaw: li.descriptionRaw ?? null,
          qty: li.qty ?? 1,
          unitPrice: li.unitPrice != null ? new Prisma.Decimal(li.unitPrice.toFixed(2)) : null,
          lineTotal: li.lineTotal != null ? new Prisma.Decimal(li.lineTotal.toFixed(2)) : null,
        })),
      });
    }

    // If debug requested, include raw AWS payload to inspect what Textract returned
    if (debug) {
      return Response.json({ ok: true, items: parsed.lineItems.length, parsed, raw: resp });
    }
    return Response.json({ ok: true, items: parsed.lineItems.length, parsed });
  } catch (e) {
    console.error("[OCR_ERROR]", e);
    return new Response("OCR failed", { status: 500 });
  }
}
