// src/app/health/page.tsx
export default function HealthPage() {
  return (
    <main className="mx-auto max-w-2xl p-8 space-y-4">
      <h1 className="text-2xl font-semibold">ReceiptIQ Health</h1>
      <ul className="list-disc pl-5 text-sm">
        <li>Next.js App Router running</li>
        <li>Tailwind loaded</li>
      </ul>

      <a className="text-blue-600 underline" href="/api/health/db">
        Check DB API
      </a>
    </main>
  );
}
