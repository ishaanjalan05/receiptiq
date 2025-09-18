// src/app/api/receipts/route.ts
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { key, originalName, groupId } = await req.json();
    if (!key || typeof key !== "string") {
      return new Response("Missing key", { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) return new Response("User not found", { status: 404 });


    if (groupId) {
  const isMember = await prisma.membership.findFirst({
    where: { groupId, userId: user.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!isMember) return new Response("Not a member of this group", { status: 403 });
} 

    const receipt = await prisma.receipt.create({
      data: {
        userId: user.id,
        groupId: groupId ?? null,
        imageUrl: key, // we store the S3 key/path here
      },
      select: { id: true },
    });

    return Response.json({ receiptId: receipt.id });
  } catch (err) {
    console.error("[RECEIPTS_POST_ERROR]", err);
    return new Response("Failed to create receipt", { status: 500 });
  }
}
