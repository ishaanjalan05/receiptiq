"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError("Please enter your email");
      return;
    }
    setLoading(true);
    // Use next-auth signIn with email provider and redirect to callback URL
    const res = await signIn("email", {
      email,
      redirect: false,
      callbackUrl: "/upload",
    });
    setLoading(false);

    if (res?.error) {
      setError(res.error || "Sign in failed");
      return;
    }

  // On success, send the user to the upload page so they can start using the app.
  // The magic link is printed to server console in dev.
  router.push("/upload");
  }

  return (
    <div className="max-w-md mx-auto mt-24 p-6 border rounded">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="sr-only">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 border rounded"
          />
        </label>

        {error && <p className="text-red-600">{error}</p>}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send magic link"}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        In development the magic link is printed to the server console.
      </p>
    </div>
  );
}
