// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const user = await db.user.upsert({
    where: { email: "dev@example.com" },
    update: {},
    create: { email: "dev@example.com", name: "Dev User" },
  });

  const group = await db.group.create({ data: { name: "Apartment 302" } });

  await db.membership.create({
    data: { userId: user.id, groupId: group.id, role: "owner" },
  });

  console.log({ user, group });
}

main().finally(async () => {
  await db.$disconnect();
});
