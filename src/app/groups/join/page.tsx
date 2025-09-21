// src/app/groups/join/page.tsx
import { Suspense } from "react";
import ClientJoin from "./ClientJoin";

export const dynamic = "force-dynamic"; // avoid prerender issues with query params

export default function JoinGroupPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-gray-500">Loading…</main>}>
      <ClientJoin />
    </Suspense>
  );
}
