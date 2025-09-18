"use client";
import { useEffect, useMemo, useState } from "react";

export default function GroupDetail({ groupId }: { groupId: string }) {
  const [group, setGroup] = useState<any>(null);
  const [invite, setInvite] = useState<{token:string; expiresAt:string}|null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/groups/${groupId}`);
      if (r.ok) setGroup(await r.json());
      else setErr(await r.text());
    })();
  }, [groupId]);

  async function createInvite() {
    setErr("");
    const r = await fetch(`/api/groups/${groupId}/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (!r.ok) { setErr(await r.text()); return; }
    setInvite(await r.json());
  }

  const joinUrl = useMemo(() => {
    if (!invite) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/groups/join?token=${invite.token}`;
  }, [invite]);

  if (!group) return <main className="p-6 text-sm text-gray-600">{err || "Loading…"}</main>;

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">{group.name}</h1>

      <section>
        <h2 className="font-medium">Members</h2>
        <ul className="list-disc pl-6">
          {group.members.map((m: any) => (
            <li key={m.id}>
              {(m.user.name || m.user.email)} — {m.role}{m.status !== "ACTIVE" ? ` (${m.status})` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <button onClick={createInvite} className="rounded bg-gray-900 text-white px-3 py-2">Create invite link</button>
        {invite && (
          <div className="text-sm">
            <p>Invite link (valid until {new Date(invite.expiresAt).toLocaleString()}):</p>
            <input readOnly className="w-full border rounded p-2" value={joinUrl} />
          </div>
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </section>
    </main>
  );
}
