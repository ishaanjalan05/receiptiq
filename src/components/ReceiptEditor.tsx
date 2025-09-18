"use client";
import { useEffect, useMemo, useState } from "react";

const CATEGORIES = ["GROCERIES","HOUSEHOLD","DINING","UTILITIES","TRANSPORT","MISC"] as const;

type Item = {
  id: string;
  descriptionRaw?: string;
  qty?: number;
  unitPrice?: number | null;
  lineTotal?: number | null;
  category?: typeof CATEGORIES[number] | null;
};

export default function ReceiptEditor({ receiptId }: { receiptId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [merchant, setMerchant] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [totals, setTotals] = useState({ subtotal: 0, tax: 0, tip: 0, total: 0 });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const r = await fetch(`/api/receipts/${receiptId}`);
      if (!r.ok) { setError(await r.text()); setLoading(false); return; }
      const data = await r.json();
      setMerchant(data.merchantNormalized || data.merchantRaw || "");
      setDate(data.purchaseDate ? new Date(data.purchaseDate).toISOString().slice(0,10) : "");
      setItems(data.lineItems.map((li: any) => ({
        id: li.id,
        descriptionRaw: li.descriptionRaw || "",
        qty: li.qty ?? 1,
        unitPrice: li.unitPrice ? Number(li.unitPrice) : null,
        lineTotal: li.lineTotal ? Number(li.lineTotal) : null,
        category: li.category || null,
      })));
      setTotals({
        subtotal: data.subtotal ? Number(data.subtotal) : 0,
        tax: data.tax ? Number(data.tax) : 0,
        tip: data.tip ? Number(data.tip) : 0,
        total: data.total ? Number(data.total) : 0,
      });
      setLoading(false);
    }
    load();
  }, [receiptId]);

  const computedSubtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const qty = it.qty ?? 1;
      const price = it.unitPrice ?? it.lineTotal ?? 0;
      // prefer explicit lineTotal; else qty*unitPrice
      const line = it.lineTotal ?? (it.unitPrice != null ? qty * it.unitPrice : 0);
      return sum + (line || 0);
    }, 0);
  }, [items]);

  const diff = useMemo(() => {
    const expected = (totals.subtotal ?? 0) + (totals.tax ?? 0) + (totals.tip ?? 0);
    return Number((expected - (totals.total ?? 0)).toFixed(2));
  }, [totals]);

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/receipts/${receiptId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantNormalized: merchant || undefined,
        purchaseDate: date || undefined,
        totals,
        items,
      }),
    });
    if (!res.ok) setError(await res.text());
    setSaving(false);
  }

    async function autoCategorize() {
  setSaving(true);
  setError("");

  try {
    const resp = await fetch(`/api/receipts/${receiptId}/categorize`, { method: "POST" });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "request failed");
      setError(`Auto-categorize failed: ${t}`);
      return;
    }

    // Server payload: { applied: number, items: [{ id, category }] }
    const data: { applied: number; items: Array<{ id: string; category: any }> } =
      await resp.json();

    // restrict to our Category union
    type Cat = typeof CATEGORIES[number];
    const asCat = (v: any): Cat | null =>
      (CATEGORIES as readonly string[]).includes(v as string) ? (v as Cat) : null;

    const map = new Map<string, Cat | null>(
      data.items.map((it) => [it.id, asCat(it.category)])
    );

    setItems((prev) =>
      prev.map((it) => ({ ...it, category: map.get(it.id) ?? it.category }))
    );
  } catch (err: any) {
    setError(err?.message ?? String(err));
  } finally {
    setSaving(false);
  }
}



  function patchItem(i: number, patch: Partial<Item>) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }

  

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm">Merchant
          <input value={merchant} onChange={e=>setMerchant(e.target.value)} className="mt-1 w-full rounded border p-2"/>
        </label>
        <label className="text-sm">Purchase date
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 w-full rounded border p-2"/>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border rounded">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Description</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Unit</th>
              <th className="p-2">Line total</th>
              <th className="p-2">Category</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className="border-t">
                <td className="p-2">
                  <input value={it.descriptionRaw || ""} onChange={e=>patchItem(i,{ descriptionRaw: e.target.value })} className="w-full rounded border p-1"/>
                </td>
                <td className="p-2 w-20">
                  <input type="number" min={1} value={it.qty ?? 1} onChange={e=>patchItem(i,{ qty: Number(e.target.value) })} className="w-full rounded border p-1 text-right"/>
                </td>
                <td className="p-2 w-28">
                  <input type="number" step="0.01" value={it.unitPrice ?? ""} onChange={e=>patchItem(i,{ unitPrice: e.target.value === "" ? null : Number(e.target.value) })} className="w-full rounded border p-1 text-right"/>
                </td>
                <td className="p-2 w-28">
                  <input type="number" step="0.01" value={it.lineTotal ?? ""} onChange={e=>patchItem(i,{ lineTotal: e.target.value === "" ? null : Number(e.target.value) })} className="w-full rounded border p-1 text-right"/>
                </td>
                <td className="p-2 w-40">
                  <select value={it.category || ""} onChange={e=>patchItem(i,{ category: (e.target.value || null) as any })} className="w-full rounded border p-1">
                    <option value="">—</option>
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="text-sm">Subtotal
          <input type="number" step="0.01" value={totals.subtotal} onChange={e=>setTotals(t=>({...t, subtotal: Number(e.target.value)}))} className="mt-1 w-full rounded border p-2 text-right"/>
        </label>
        <label className="text-sm">Tax
          <input type="number" step="0.01" value={totals.tax} onChange={e=>setTotals(t=>({...t, tax: Number(e.target.value)}))} className="mt-1 w-full rounded border p-2 text-right"/>
        </label>
        <label className="text-sm">Tip
          <input type="number" step="0.01" value={totals.tip} onChange={e=>setTotals(t=>({...t, tip: Number(e.target.value)}))} className="mt-1 w-full rounded border p-2 text-right"/>
        </label>
        <label className="text-sm">Total
          <input type="number" step="0.01" value={totals.total} onChange={e=>setTotals(t=>({...t, total: Number(e.target.value)}))} className="mt-1 w-full rounded border p-2 text-right"/>
        </label>
      </div>

      <div className="text-sm text-gray-600">
        <p>Computed subtotal (from items): <b>{computedSubtotal.toFixed(2)}</b></p>
        <p>Reconciliation diff (subtotal+tax+tip - total): {diff === 0 ? <b className="text-green-600">0.00</b> : <b className="text-amber-600">{diff.toFixed(2)}</b>}</p>
      </div>

      <div className="flex gap-3">
  <button onClick={save} disabled={saving} className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-50">
    {saving ? "Saving…" : "Save changes"}
  </button>
  <button onClick={autoCategorize} disabled={saving} className="rounded bg-gray-800 text-white px-4 py-2 disabled:opacity-50">
    Auto-categorize
  </button>

    <a
    href={`/receipts/${receiptId}/split`}
    className="rounded bg-gray-700 text-white px-3 py-2"
    >
    Open Split Calculator
    </a>
</div>

    </div>
  );
}