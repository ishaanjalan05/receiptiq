"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function NamePrompt() {
  const [name, setName] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: session } = useSession();

  useEffect(() => {
    // Try to load the user's name from a lightweight endpoint
    (async () => {
      try {
        const r = await fetch("/api/profile/me");
        if (!r.ok) return;
        const data = await r.json();
        if (data?.name) setName(data.name);
      } catch {}
    })();
  }, []);

  async function save() {
    const n = input.trim();
    if (!n) return;
    setSaving(true);
    await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
    }).catch(() => {});
    setName(n);
    setInput("");
    setShow(false);
    setSaving(false);
  }

  // If user is signed in and has no name we auto-show the input
  if (name) return <div className="text-sm text-gray-700">{name}</div>;
  if (session?.user && !show) setShow(true);

  return (
    <div>
      {!show && (
        <button onClick={() => setShow(true)} className="text-sm text-gray-600 hover:underline">Set name</button>
      )}

      {show && (
        <div className="flex items-center gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Your name" className="rounded border px-2 py-1 text-sm" />
          <button onClick={save} disabled={saving} className="rounded bg-blue-600 text-white px-3 py-1 text-sm">{saving ? "Saving…" : "Save"}</button>
        </div>
      )}
    </div>
  );
}
