"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthAction() {
  const { data: session, status } = useSession();

  if (status === "loading") return <div className="text-sm text-gray-600">Checking…</div>;

  if (session?.user) {
    return (
      <button onClick={() => signOut()} className="px-3 py-1 rounded bg-gray-900 text-white text-sm">Sign out</button>
    );
  }

  return (
    <button onClick={() => signIn(undefined, { callbackUrl: "/upload" })} className="text-sm text-gray-600 hover:underline">Sign in</button>
  );
}
