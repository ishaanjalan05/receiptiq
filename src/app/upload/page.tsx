import UploadReceipt from "@/components/UploadReceipt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function UploadPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin");

  return (
    <main className="p-8">
      <UploadReceipt />
    </main>
  );
}