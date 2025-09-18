// src/lib/parseTextract.ts

// Helper: get the last money-looking number on a line (most receipts print amount at the end)
function lastMoney(line: string): number | null {
  const matches = [...line.matchAll(/(?:\$?\s*)(\d+\.\d{2})/g)];
  if (!matches.length) return null;
  return parseFloat(matches[matches.length - 1][1]);
}

// Normalize a string number (strip $ and other junk)
function num(text?: string): number | null {
  if (!text) return null;
  const m = text.replace(/[^\d.]/g, "");
  return m ? Number(m) : null;
}

type Parsed = {
  merchantRaw?: string | null;
  purchaseDate?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  tip?: number | null;
  total?: number | null;
  savings?: number | null;
  lineItems: Array<{
    descriptionRaw: string;
    qty?: number;
    unitPrice?: number;
    lineTotal?: number;
  }>;
};

export function parseAnalyzeExpense(resp: any): Parsed {
  const docs = resp?.ExpenseDocuments ?? [];

  let merchantRaw: string | null = null;
  let purchaseDate: string | null = null;
  let subtotal: number | null = null;
  let taxSum = 0;
  let tip: number | null = null;
  let total: number | null = null;
  let savingsMax: number | null = null;

  // Collect free-text lines for fallback scans
  const freeTextLines: string[] = [];

  for (const d of docs) {
    // ---- Summary fields (preferred) ----
    for (const s of d.SummaryFields ?? []) {
      const typeTxt = (s?.Type?.Text || "").toUpperCase();
      const valueTxt = s?.ValueDetection?.Text || "";
      const labelTxt = (s?.LabelDetection?.Text || "").toUpperCase();

      // Merchant / vendor
      if (!merchantRaw && /VENDOR|MERCHANT|SUPPLIER|RESTAURANT|STORE/i.test(typeTxt)) {
        merchantRaw = valueTxt;
      }

      // Dates
      if (/DATE|RECEIPT_DATE|INVOICE_DATE/.test(typeTxt) && valueTxt) {
        purchaseDate = valueTxt;
      }

      // Money fields
      const valNum = lastMoney(valueTxt);

      if (/SUBTOTAL/.test(typeTxt) && valNum != null) subtotal = valNum;
      if (/TOTAL/.test(typeTxt) && valNum != null) total = valNum;
      if (/TAX/.test(typeTxt) && valNum != null) taxSum += valNum;
      if (/TIP/.test(typeTxt) && valNum != null) tip = valNum;

      // Discounts or savings often appear as DISCOUNT/SAVINGS/PROMO
      if (/(DISCOUNT|SAVINGS|PROMO|COUPON)/.test(typeTxt) && valNum != null) {
        savingsMax = Math.max(savingsMax ?? 0, valNum);
        }

      // collect for fallback
      if (valueTxt) freeTextLines.push(valueTxt);

      
    }

    // ---- Line items (with types) ----
    for (const g of d.LineItemGroups ?? []) {
      for (const it of g.LineItems ?? []) {
        for (const f of it.LineItemExpenseFields ?? []) {
          if (f?.ValueDetection?.Text) freeTextLines.push(f.ValueDetection.Text);
        }
      }
    }
  }

  // ---- Fallback scans over free text ----
  // Sum ALL lines containing TAX + money (handles multiple state/city tax lines)
  if (taxSum === 0) {
    for (const raw of freeTextLines) {
      const line = raw.toUpperCase();
      if (line.includes("TAX")) {
        const m = lastMoney(line);
        if (m != null) taxSum += m;
      }
    }
  }

  // Store-wide savings / coupons without hard-coding phrases:
  // Look for lines containing OFF/COUPON/SAVE/SAVINGS/PROMO and money
  for (const raw of freeTextLines) {
    const lineU = raw.toUpperCase();
    if ((/OFF|COUPON|SAVE|SAVINGS|PROMO/.test(lineU)) && /\d+\.\d{2}/.test(lineU)) {
  const m = lastMoney(lineU);
  if (m != null) savingsMax = Math.max(savingsMax ?? 0, m);
}
  }

  // ---- Build items array (best-effort) ----
  const items: Parsed["lineItems"] = [];

  for (const d of docs) {
    for (const g of d.LineItemGroups ?? []) {
      for (const it of g.LineItems ?? []) {
        const fields = it.LineItemExpenseFields ?? [];

        // Pull common types, falling back to concatenated text
        const desc =
          fields.find((f: any) => (f?.Type?.Text || "").toUpperCase().includes("ITEM"))?.ValueDetection?.Text ??
          fields.find((f: any) => (f?.LabelDetection?.Text || "").toUpperCase().includes("DESCRIPTION"))?.ValueDetection?.Text ??
          fields.map((f: any) => f?.ValueDetection?.Text).filter(Boolean).join(" ") ??
          "";

        const qtyText =
          fields.find((f: any) => (f?.Type?.Text || "").toUpperCase().includes("QUANTITY"))?.ValueDetection?.Text ??
          fields.find((f: any) => (f?.LabelDetection?.Text || "").toUpperCase().includes("QTY"))?.ValueDetection?.Text;

        const unitText =
          fields.find((f: any) => (f?.Type?.Text || "").toUpperCase().includes("PRICE"))?.ValueDetection?.Text ??
          fields.find((f: any) => (f?.LabelDetection?.Text || "").toUpperCase().includes("UNIT"))?.ValueDetection?.Text;

        const totalText =
          fields.find((f: any) => (f?.Type?.Text || "").toUpperCase().includes("AMOUNT"))?.ValueDetection?.Text ??
          fields.find((f: any) => (f?.Type?.Text || "").toUpperCase().includes("TOTAL"))?.ValueDetection?.Text ??
          fields.find((f: any) => (f?.LabelDetection?.Text || "").toUpperCase().includes("AMOUNT"))?.ValueDetection?.Text ??
          fields.find((f: any) => (f?.LabelDetection?.Text || "").toUpperCase().includes("TOTAL"))?.ValueDetection?.Text;

        const qty = num(qtyText) ?? undefined;
        const unitPrice = num(unitText) ?? undefined;
        const lineTotal = num(totalText) ?? undefined;

        items.push({
          descriptionRaw: desc || "",
          qty,
          unitPrice,
          lineTotal,
        });
      }
    }
  }

  return {
    merchantRaw,
    purchaseDate,
    subtotal,
    tax: taxSum || null,
    tip,
    total,
    savings: savingsMax ?? null,
    lineItems: items,
  };
}
