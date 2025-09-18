import SplitCalculator from "@/components/SplitCalculator";

export default async function SplitPage(
  props: { params: Promise<{ id: string }> } // Next 15: await params
) {
  const { id } = await props.params;
  return (
    <main className="p-6">
      <SplitCalculator receiptId={id} />
    </main>
  );
}
