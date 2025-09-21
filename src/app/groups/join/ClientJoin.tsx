// src/app/groups/join/ClientJoin.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function ClientJoin() {
  const sp = useSearchParams();
  const token = sp.get("token");
  const router = useRouter();
  const [msg, setMsg] = useState("Joining…");

  useEffect(() => {
    (async () => {
      if (!token) { setMsg("Missing token"); return; }
      const r = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!r.ok) { setMsg(await r.text()); return; }
      const data = await r.json();
      router.replace(`/groups/${data.groupId}`);
    })();
  }, [token, router]);

  return <main className="p-6 text-sm text-gray-600">{msg}</main>;
}
