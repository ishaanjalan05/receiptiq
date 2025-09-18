import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return new Response("Unauthorized", { status: 401 });

  const me = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!me) return new Response("User not found", { status: 404 });

  const { token } = await req.json();
  if (!token) return new Response("Missing token", { status: 400 });

  const invite = await prisma.invite.findUnique({
    where: { token },
    select: { id: true, groupId: true, email: true, expiresAt: true },
  });
  if (!invite) return new Response("Invalid invite", { status: 400 });
  if (invite.expiresAt < new Date()) return new Response("Invite expired", { status: 400 });
  if (invite.email && invite.email.toLowerCase() !== me.email!.toLowerCase()) {
    return new Response("Invite locked to a different email", { status: 400 });
  }

  await prisma.membership.upsert({
    where: { userId_groupId: { userId: me.id, groupId: invite.groupId } },
    update: { status: "ACTIVE" },
    create: { userId: me.id, groupId: invite.groupId, role: "MEMBER", status: "ACTIVE" },
  });

  // single-use: delete invite (comment out to allow multi-use)
  await prisma.invite.delete({ where: { token } }).catch(() => {});

  return Response.json({ ok: true, groupId: invite.groupId });
}
