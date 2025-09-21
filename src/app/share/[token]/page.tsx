import { prisma } from "@/lib/db";

export default async function SharePage(
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params;

  const split = await prisma.split.findUnique({
    where: { shareToken: token },
    select: {
      snapshot: true,
      receipt: {
        select: {
          merchantNormalized: true,
          merchantRaw: true,
          purchaseDate: true,
          total: true,
        },
      },
      createdAt: true,
    },
  });

  if (!split) {
    return <main className="p-6">Invalid or expired link.</main>;
  }

  const sn: any = split.snapshot;
  const title = split.receipt.merchantNormalized || split.receipt.merchantRaw || "Receipt";

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">Split — {title}</h1>
      <p className="text-sm text-gray-500">
        {split.receipt.purchaseDate ? new Date(split.receipt.purchaseDate as any).toLocaleString() : ""}
      </p>

      <div className="rounded border">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Person</th>
              <th className="p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sn.participants.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.name}</td>
                <td className="p-2 text-right">
                  ${Number(sn.totals[p.id] ?? 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Generated {new Date(split.createdAt).toLocaleString()}
        {sn.propTaxTip ? " • Tax & tip allocated proportionally" : ""}
      </p>
    </main>
  );
}
