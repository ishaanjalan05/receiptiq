"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      className="px-3 py-1 rounded bg-gray-900 text-white"
      onClick={() => signOut()}
    >
      Sign out
    </button>
  );
}