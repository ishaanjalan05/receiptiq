// src/app/api/receipts/[id]/split/route.ts
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { randomBytes } from "crypto";

// cents helpers & fair allocation
const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

function scaleToTargetC(amountsC: number[], targetC: number): number[] {
  const sum = amountsC.reduce((a, b) => a + b, 0);
  if (sum === 0) return amountsC.map(() => 0);
  const raw = amountsC.map((a) => (a / sum) * targetC);
  const floors = raw.map(Math.floor);
  let leftover = targetC - floors.reduce((a, b) => a + b, 0);
  const rem = raw
    .map((x, i) => ({ i, r: x - floors[i] }))
    .sort((a, b) => b.r - a.r);
  const out = [...floors];
  for (let k = 0; k < leftover; k++) out[rem[k].i] += 1;
  return out;
}

function splitEvenC(amountC: number, ids: string[]): Record<string, number> {
  const n = ids.length || 1;
  const q = Math.floor(amountC / n);
  let r = amountC - q * n;
  const res: Record<string, number> = {};
  ids.forEach((id, idx) => (res[id] = q + (idx < r ? 1 : 0)));
  return res;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return new Response("Unauthorized", { status: 401 });

  const me = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!me) return new Response("User not found", { status: 404 });

  // owner OR active group member
  const receipt = await prisma.receipt.findFirst({
    where: {
      id,
      OR: [
        { userId: me.id },
        { group: { members: { some: { userId: me.id, status: "ACTIVE" } } } },
      ],
    },
    select: {
      id: true,
      subtotal: true,
      tax: true,
      tip: true,
      total: true,
      lineItems: {
        select: { id: true, qty: true, unitPrice: true, lineTotal: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!receipt) return new Response("Not found", { status: 404 });

  const body = (await req.json()) as {
    participants: Array<{ id: string; name: string }>;
    assign: Record<string, string[]>;
    propTaxTip?: boolean;
  };

  const participants = body.participants ?? [];
  const assign = body.assign ?? {};
  const propTaxTip = !!body.propTaxTip;

  // --- 1) base item cents (pre-discount, as extracted) ---
  const baseItemC = receipt.lineItems.map((li) => {
    const qty = li.qty ?? 1;
    const amt =
      li.lineTotal != null
        ? Number(li.lineTotal)
        : li.unitPrice != null
        ? qty * Number(li.unitPrice)
        : 0;
    return Math.max(0, toCents(amt));
  });
  const itemsSumC = baseItemC.reduce((a, b) => a + b, 0);

  // --- 2) receipt-level numbers ---
  const taxC = toCents(Number(receipt.tax ?? 0));
  const tipC = toCents(Number(receipt.tip ?? 0));
  const subtotalC_fallback = toCents(
    Number(receipt.subtotal ?? fromCents(itemsSumC))
  );
  const totalC = (() => {
    const t = Number(receipt.total ?? 0);
    return t ? toCents(t) : subtotalC_fallback + taxC + tipC;
  })();

  // --- 3) ALWAYS scale items to pre-tax target (total - tax - tip) ---
  const preTaxTargetC = Math.max(0, totalC - taxC - tipC);
  const needScaleDown = itemsSumC > preTaxTargetC + 1; // +1c tolerance
  const adjItemC = needScaleDown
    ? scaleToTargetC(baseItemC, preTaxTargetC)
    : baseItemC;

  // --- 4) allocate adjusted items by assignment ---
  const perItems: Record<string, number> = {};
  participants.forEach((p) => (perItems[p.id] = 0));

  receipt.lineItems.forEach((li, idx) => {
    const amtC = adjItemC[idx];
    if (amtC <= 0) return;

    const who = (assign[li.id] ?? []).filter((pid) =>
      participants.some((p) => p.id === pid)
    );
    const list = who.length ? who : participants[0] ? [participants[0].id] : [];
    const shares = splitEvenC(amtC, list);
    Object.entries(shares).forEach(
      ([pid, c]) => (perItems[pid] = (perItems[pid] ?? 0) + c)
    );
  });

  // --- 5) optionally allocate tax+tip proportionally ---
  const perFinal: Record<string, number> = { ...perItems };
  const itemsTotalC = Object.values(perItems).reduce((a, b) => a + b, 0);
  if (propTaxTip && itemsTotalC > 0) {
    const ids = participants.map((p) => p.id);
    const weights = ids.map((k) => perItems[k] ?? 0);
    const taxAlloc = scaleToTargetC(weights, taxC);
    const tipAlloc = scaleToTargetC(weights, tipC);
    ids.forEach((k, i) => (perFinal[k] += taxAlloc[i] + tipAlloc[i]));
  }

  // --- 6) reconcile to exact total (penny-perfect) ---
  const sumNow = Object.values(perFinal).reduce((a, b) => a + b, 0);
  let delta = totalC - sumNow;
  if (delta !== 0 && participants.length > 0) {
    const order = [...participants]
      .map((p) => ({ id: p.id, spent: perItems[p.id] ?? 0 }))
      .sort((a, b) => b.spent - a.spent)
      .map((x) => x.id);
    const sign = Math.sign(delta);
    delta = Math.abs(delta);
    for (let i = 0; i < delta; i++) perFinal[order[i % order.length]] += sign;
  }

  const totals = Object.fromEntries(
    participants.map((p) => [
      p.id,
      Number(fromCents(perFinal[p.id] ?? 0).toFixed(2)),
    ])
  );

  // --- 7) save snapshot + share link ---
  const shareToken = randomBytes(16).toString("hex");
  const snapshot = {
    participants,
    assign,
    propTaxTip,
    totals,
    createdAt: new Date().toISOString(),
  };

  const split = await prisma.split.create({
    data: { receiptId: receipt.id, createdBy: me.id, shareToken, snapshot },
    select: { id: true, shareToken: true },
  });

  // Optional dev log to see what math the server used
  if (process.env.NODE_ENV !== "production") {
    console.log("[SPLIT_DEBUG]", {
      itemsSumC,
      preTaxTargetC,
      taxC,
      tipC,
      totalC,
      needScaleDown,
    });
  }

  return Response.json({
    ok: true,
    splitId: split.id,
    shareUrl: `/share/${split.shareToken}`,
  });
}
