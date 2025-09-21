import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.email) return new NextResponse(null, { status: 204 });
  const u = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!u) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ name: u.name || null });
}
