"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OpenSplitButton({ receiptId, computedSubtotal, totals, save }: any) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  return (
    <button
      className="rounded bg-gray-700 text-white px-3 py-2"
      onClick={async () => {
        setLoading(true);
        const ok = await save();
        setLoading(false);
        if (ok) router.push(`/receipts/${receiptId}/split`);
        else alert("Failed to save changes before opening the split calculator. See error message above.");
      }}
      disabled={loading}
    >
      {loading ? "Saving…" : "Open Split Calculator"}
    </button>
  );
}
