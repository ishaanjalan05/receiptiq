import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return new Response("Unauthorized", { status: 401 });

  const { name } = await req.json();
  if (!name) return new Response("Missing name", { status: 400 });

  const me = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!me) return new Response("User not found", { status: 404 });

  const group = await prisma.group.create({
    data: {
      name,
      createdBy: me.id, // string id per your schema
      members: {
        create: { userId: me.id, role: "OWNER", status: "ACTIVE" }, // works with enum or string fallback
      },
    },
    select: { id: true, name: true, createdAt: true },
  });

  return Response.json(group);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return new Response("Unauthorized", { status: 401 });

  const me = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!me) return new Response("User not found", { status: 404 });

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: me.id, status: "ACTIVE" } } },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(groups);
}
