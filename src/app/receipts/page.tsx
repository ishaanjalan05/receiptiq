import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ReceiptsListPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) redirect("/api/auth/signin");

  const me = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!me) redirect("/api/auth/signin");

  const receipts = await prisma.receipt.findMany({
    where: {
      OR: [
        { userId: me.id }, // my personal receipts
        { group: { members: { some: { userId: me.id, status: "ACTIVE" } } } }, // group receipts I belong to
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      merchantNormalized: true,
      merchantRaw: true,
      total: true,
      createdAt: true,
      group: { select: { id: true, name: true } },
    },
  });

  // Prisma Decimal -> number
  const asNumber = (v: any) =>
    v == null ? 0 : typeof v === "number" ? v : parseFloat(String(v));

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">My receipts</h1>

      {receipts.length === 0 ? (
        <p className="text-sm text-gray-500">No receipts yet.</p>
      ) : (
        <ul className="divide-y border rounded">
          {receipts.map((r) => (
            <li key={r.id} className="p-3 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <a className="font-medium hover:underline" href={`/receipts/${r.id}`}>
                  {r.merchantNormalized || r.merchantRaw || "Receipt"}
                </a>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="inline-block rounded-full border px-2 py-0.5">
                    {r.group?.name ? `Group: ${r.group.name}` : "Personal"}
                  </span>
                  <span>{new Date(r.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Total</div>
                <div className="font-semibold">${asNumber(r.total).toFixed(2)}</div>
                <a
                  className="text-xs text-blue-600 hover:underline"
                  href={`/receipts/${r.id}/split`}
                >
                  Split
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
