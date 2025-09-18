"use client";
import { useEffect, useState } from "react";

export default function GroupsPage() {
  const [groups, setGroups] = useState<Array<{id:string; name:string; createdAt:string}>>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/groups");
      if (r.ok) setGroups(await r.json());
    })();
  }, []);

  async function createGroup() {
    const r = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      const g = await r.json();
      setGroups(prev => [g, ...prev]);
      setName("");
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">Your Groups</h1>
      <div className="flex gap-2">
        <input className="border rounded p-2" value={name} onChange={e=>setName(e.target.value)} placeholder="Group name (e.g., Apt 3B)" />
        <button onClick={createGroup} className="rounded bg-gray-900 text-white px-3">Create</button>
      </div>
      <ul className="list-disc pl-6">
        {groups.map(g => (
          <li key={g.id}>
            <a className="text-blue-600 underline" href={`/groups/${g.id}`}>{g.name}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
