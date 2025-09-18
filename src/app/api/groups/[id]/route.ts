import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return new Response("Unauthorized", { status: 401 });

  const me = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!me) return new Response("User not found", { status: 404 });

  const group = await prisma.group.findFirst({
    where: { id, members: { some: { userId: me.id, status: "ACTIVE" } } },
    select: {
      id: true,
      name: true,
      members: {
        select: {
          id: true,
          role: true,
          status: true,
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!group) return new Response("Not found", { status: 404 });
  return Response.json(group);
}
