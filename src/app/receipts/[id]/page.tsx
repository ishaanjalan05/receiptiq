import ReceiptEditor from "@/components/ReceiptEditor";

export default async function ReceiptPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;      // ✅ await params
  return (
    <main className="p-6">
      <ReceiptEditor receiptId={id} />
    </main>
  );
}
