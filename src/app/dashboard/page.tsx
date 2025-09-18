import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";


export default async function DashboardPage() {
const session = await getServerSession(authOptions);
if (!session) redirect("/api/auth/signin");


return (
<main className="mx-auto max-w-2xl p-8 space-y-4">
<h1 className="text-2xl font-semibold">Dashboard</h1>
<pre className="bg-zinc-900 text-zinc-100 border border-zinc-800 rounded p-3 overflow-auto text-sm leading-relaxed whitespace-pre-wrap">
{JSON.stringify(session, null, 2)}
</pre>
<p className="text-sm text-gray-600">
Email: <b>{session.user?.email ?? "(not present in session)"}</b>
</p>
<SignOutButton />
</main>
);
}



