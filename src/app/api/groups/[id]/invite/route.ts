import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { randomBytes } from "crypto";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return new Response("Unauthorized", { status: 401 });

  const me = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!me) return new Response("User not found", { status: 404 });

  // must be OWNER of the group
  const owner = await prisma.membership.findFirst({
    where: { groupId: id, userId: me.id, role: "OWNER", status: "ACTIVE" },
    select: { id: true },
  });
  if (!owner) return new Response("Forbidden", { status: 403 });

  const body = await req.json().catch(() => ({}));
  const lockEmail = (body?.email as string | undefined) ?? null;

  const token = randomBytes(16).toString("hex");
  const invite = await prisma.invite.create({
    data: {
      groupId: id,
      token,
      email: lockEmail,
      createdBy: me.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
    },
    select: { token: true, expiresAt: true },
  });

  return Response.json(invite);
}
