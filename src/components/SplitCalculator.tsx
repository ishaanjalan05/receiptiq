"use client";

import { useEffect, useMemo, useState } from "react";

type LineItem = {
  id: string;
  descriptionRaw?: string | null;
  qty?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  category?: string | null;
};

type MemberUser = { id: string; name: string | null; email: string };
type GroupLight = {
  id: string;
  name: string;
  members: Array<{ user: MemberUser; role: string; status: string }>;
};

type Receipt = {
  id: string;
  groupId?: string | null;
  group?: GroupLight | null;
  merchantRaw?: string | null;
  merchantNormalized?: string | null;
  purchaseDate?: string | null;
  subtotal?: number | string | null;
  tax?: number | string | null;
  tip?: number | string | null;
  total?: number | string | null;
  lineItems: LineItem[];
};

type Person = { id: string; name: string };

function toCents(n: number) {
  return Math.round(n * 100);
}
function fromCents(c: number) {
  return c / 100;
}

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

function liTotal(li: LineItem) {
  const qty = li.qty ?? 1;
  if (li.lineTotal != null) return Number(li.lineTotal);
  if (li.unitPrice != null) return qty * Number(li.unitPrice);
  return 0;
}

export default function SplitCalculator({ receiptId }: { receiptId: string }) {
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [newName, setNewName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");
  const [assign, setAssign] = useState<Record<string, Set<string>>>({});
  const [propTaxTip, setPropTaxTip] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await fetch(`/api/receipts/${receiptId}`);
      if (!r.ok) {
        setLoading(false);
        return;
      }
      const data: Receipt = await r.json();

      // Build initial people list
      let initialPeople: Person[] = [];
      if (data.group && data.group.members?.length) {
        initialPeople = data.group.members
          .filter((m) => m.status === "ACTIVE")
          .map((m) => ({
            id: m.user.id,
            name: m.user.name || m.user.email,
          }));
      } else {
        initialPeople = [
          { id: "me", name: "Me" },
          { id: "a", name: "Roommate A" },
          { id: "b", name: "Roommate B" },
        ];
      }

      // Default assignments: all people on any non-zero line item
      const everyone = new Set(initialPeople.map((p) => p.id));
      const initAssign: Record<string, Set<string>> = {};
      for (const li of data.lineItems) {
        const amount = liTotal(li);
        initAssign[li.id] = amount > 0 ? new Set(everyone) : new Set();
      }

      setReceipt(data);
      setPeople(initialPeople);
      setAssign(initAssign);
      setLoading(false);
    })();
  }, [receiptId]);

  function togglePerson(liId: string, personId: string) {
    setAssign((prev) => {
      const next = { ...prev };
      const cur = new Set(next[liId] ?? new Set());
      if (cur.has(personId)) cur.delete(personId);
      else cur.add(personId);
      next[liId] = cur;
      return next;
    });
  }

  function setEveryone(liId: string, enabled: boolean) {
    setAssign((prev) => {
      const next = { ...prev };
      next[liId] = enabled ? new Set(people.map((p) => p.id)) : new Set();
      return next;
    });
  }

  function addPerson() {
    const name = newName.trim();
    if (!name) return;
    const id = Math.random().toString(36).slice(2, 8);
    const prevCount = people.length;

    setPeople((prev) => [...prev, { id, name }]);

    // If an item was assigned to everyone before, keep it that way (include new person).
    setAssign((prev) => {
      const next: typeof prev = {};
      for (const [k, v] of Object.entries(prev)) {
        const s = new Set(v);
        if (s.size === prevCount) s.add(id);
        next[k] = s;
      }
      return next;
    });

    setNewName("");
  }

  function addItem() {
    const desc = newItemDesc.trim();
    const amt = parseFloat(newItemAmount);
    if (!desc || isNaN(amt)) return;
    const li: LineItem = {
      id: Math.random().toString(36).slice(2, 8),
      descriptionRaw: desc,
      lineTotal: amt,
    };
    setReceipt((r) => (r ? { ...r, lineItems: [...r.lineItems, li] } : r));
    setAssign((prev) => ({ ...prev, [li.id]: new Set(people.map((p) => p.id)) }));
    setNewItemDesc("");
    setNewItemAmount("");
  }

  function removePerson(pid: string) {
    setPeople((prev) => prev.filter((p) => p.id !== pid));
    setAssign((prev) => {
      const next: typeof prev = {};
      for (const [k, v] of Object.entries(prev)) {
        const s = new Set(v);
        s.delete(pid);
        next[k] = s;
      }
      return next;
    });
  }

  // Compute per-person totals in cents with discount-aware scaling
  const results = useMemo(() => {
    if (!receipt)
      return { perPerson: {} as Record<string, number>, meta: {} as any };

    // 1) base items in cents
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

    // 2) receipt-level numbers
    const subtotalC_raw = toCents(
      Number(receipt.subtotal ?? fromCents(itemsSumC))
    );
    const taxC = toCents(Number(receipt.tax ?? 0));
    const tipC = toCents(Number(receipt.tip ?? 0));
    const totalC =
      toCents(Number(receipt.total ?? 0)) || subtotalC_raw + taxC + tipC;

    // 3) target pre-tax subtotal implied by totals (handles discounts)
    const preTaxTargetC = Math.max(0, totalC - taxC - tipC);

    // If items are pre-discount (Target case), itemsSumC > preTaxTargetC. Scale them down.
    const needScaleDown = itemsSumC > preTaxTargetC + 1; // +1 for rounding wiggle
    const adjItemC = needScaleDown
      ? scaleToTargetC(baseItemC, preTaxTargetC)
      : baseItemC;

    // 4) allocate adjusted items by assignment
    // Build float weights per-person across ALL items first, then convert to
    // integer cents using largest-remainder scaling. This prevents per-item
    // rounding bias when many items have odd cents.
    const perItemWeightsFloat: Record<string, number> = {};
    people.forEach((p) => (perItemWeightsFloat[p.id] = 0));

    receipt.lineItems.forEach((li, idx) => {
      const amtC = adjItemC[idx];
      if (amtC <= 0) return;
      const who = Array.from(assign[li.id] ?? new Set<string>()).filter((id) =>
        people.some((p) => p.id === id)
      );
      const list = who.length ? who : people[0] ? [people[0].id] : [];
      if (list.length === 0) return;
      const perShare = amtC / list.length; // float cents per person for this item
      for (const pid of list) perItemWeightsFloat[pid] += perShare;
    });

    // Convert float weights to integer cents fairly across the whole items total
    // Use itemsSumC (sum of adjusted items) as the target
    const ids = people.map((p) => p.id);
    const weightArr = ids.map((id) => perItemWeightsFloat[id] ?? 0);
    const itemAllocArr = scaleToTargetC(weightArr, itemsSumC);
    const perItems: Record<string, number> = {};
    ids.forEach((id, i) => (perItems[id] = itemAllocArr[i] ?? 0));

    // 5) allocate tax/tip proportionally over item spend if enabled
    const itemsTotalC = Object.values(perItems).reduce((a, b) => a + b, 0);
    const perFinal: Record<string, number> = { ...perItems };

    if (propTaxTip && itemsTotalC > 0) {
      const ids = people.map((p) => p.id);
      const weights = ids.map((id) => perItems[id] ?? 0);
      const taxAlloc = scaleToTargetC(weights, taxC);
      const tipAlloc = scaleToTargetC(weights, tipC);
      ids.forEach((id, i) => (perFinal[id] += taxAlloc[i] + tipAlloc[i]));
    }

    // 6) reconcile to exact total (penny-perfect)
    const sumNow = Object.values(perFinal).reduce((a, b) => a + b, 0);
    let delta = totalC - sumNow;
    if (delta !== 0 && people.length > 0) {
      const order = [...people]
        .map((p) => ({ id: p.id, spent: perItems[p.id] ?? 0 }))
        .sort((a, b) => b.spent - a.spent)
        .map((x) => x.id);
      const sign = Math.sign(delta);
      delta = Math.abs(delta);
      for (let i = 0; i < delta; i++) perFinal[order[i % order.length]] += sign;
    }

    return {
      perPerson: perFinal,
      meta: {
        itemsSum: fromCents(itemsSumC),
        subtotal: fromCents(subtotalC_raw),
        tax: fromCents(taxC),
        tip: fromCents(tipC),
        total: fromCents(totalC),
        preTaxTarget: fromCents(preTaxTargetC),
        scaled: needScaleDown,
        inferredDiscount: fromCents(itemsSumC - preTaxTargetC),
      },
    };
  }, [receipt, assign, people, propTaxTip]);

  function exportCSV() {
    if (!receipt) return;
    const rows = [["Person", "Amount"]];
    for (const p of people) {
      rows.push([
        p.name,
        fromCents(results.perPerson[p.id] ?? 0).toFixed(2),
      ]);
    }
    const csv = rows
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${receiptId}-split.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function saveAndShare() {
    if (!receipt) return;

    // Build a plain object version of assignments
    const assignObj: Record<string, string[]> = {};
    Object.entries(assign).forEach(([liId, set]) => {
      assignObj[liId] = Array.from(set);
    });

    const resp = await fetch(`/api/receipts/${receiptId}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participants: people, // [{id,name}]
        assign: assignObj, // { lineItemId: [personId] }
        propTaxTip, // boolean
      }),
    });

    if (!resp.ok) {
      alert(await resp.text());
      return;
    }
    const data = await resp.json();
    const url = data.shareUrl as string;
    // Open or copy
    if (typeof window !== "undefined") {
      const abs = new URL(url, window.location.origin).toString();
      await navigator.clipboard?.writeText(abs).catch(() => {});
      window.open(abs, "_blank");
    }
  }

  if (loading || !receipt)
    return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Split: {receipt.merchantNormalized || receipt.merchantRaw || "Receipt"}
          </h1>
          <p className="text-xs text-gray-400">{receipt.purchaseDate ?? ""}</p>

          {/* Explain panel for debugging/clarity */}
          {results.meta && (
            <details className="text-xs text-gray-400 mt-2">
              <summary>Explain split</summary>
              <pre className="whitespace-pre-wrap">
{`itemsSum         : $${results.meta.itemsSum.toFixed(2)}
subtotal (parsed) : $${results.meta.subtotal.toFixed(2)}
tax (parsed)      : $${results.meta.tax.toFixed(2)}
tip (parsed)      : $${results.meta.tip.toFixed(2)}
total (parsed)    : $${results.meta.total.toFixed(2)}
pre-tax target    : $${results.meta.preTaxTarget.toFixed(2)}   (total - tax - tip)
scaled items?     : ${results.meta.scaled ? "yes" : "no"}
inferred discount : $${results.meta.inferredDiscount.toFixed(2)}  (itemsSum - preTaxTarget)
`}
              </pre>
            </details>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={propTaxTip}
              onChange={(e) => setPropTaxTip(e.target.checked)}
            />
            Allocate tax & tip proportionally
          </label>
          <button
            onClick={exportCSV}
            className="rounded bg-gray-900 text-white px-3 py-2"
          >
            Export CSV
          </button>

          <button
            onClick={saveAndShare}
            className="rounded bg-green-600 text-white px-3 py-2"
          >
            Save & Share Link
          </button>
        </div>
      </div>

      {/* People */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
            >
              {p.name}
              {people.length > 1 && (
                <button
                  onClick={() => removePerson(p.id)}
                  className="text-gray-500 hover:text-red-600"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add person…"
            className="rounded border p-2 text-sm"
          />
          <button
            onClick={addPerson}
            className="rounded bg-blue-600 text-white px-3 text-sm"
          >
            Add
          </button>
        </div>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border rounded">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Item</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2">Everyone</th>
              <th className="p-2">Assign</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lineItems.map((li) => {
              const amount = liTotal(li);
              const set = assign[li.id] ?? new Set<string>();
              const allSelected = set.size === people.length && people.length > 0;

              return (
                <tr key={li.id} className="border-t">
                  <td className="p-2">{li.descriptionRaw || "(untitled)"}</td>
                  <td className="p-2 text-right">{amount.toFixed(2)}</td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => setEveryone(li.id, e.target.checked)}
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      {people.map((p) => (
                        <label
                          key={p.id}
                          className="inline-flex items-center gap-1"
                        >
                          <input
                            type="checkbox"
                            checked={assign[li.id]?.has(p.id) ?? false}
                            onChange={() => togglePerson(li.id, p.id)}
                          />
                          <span className="text-xs">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

  {/* (Add item moved to Receipt editor page) */}

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {people.map((p) => (
          <div key={p.id} className="rounded border p-3">
            <div className="text-sm text-gray-500">{p.name}</div>
            <div className="text-lg font-semibold">
              ${fromCents(results.perPerson[p.id] ?? 0).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
