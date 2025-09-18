import GroupDetail from "@/components/GroupDetail";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <GroupDetail groupId={id} />;
}
