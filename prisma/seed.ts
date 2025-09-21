// prisma/seed.ts
import { PrismaClient, Role /* , MemberStatus */ } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  // Create (or fetch) a dev user
  const user = await db.user.upsert({
    where: { email: "dev@example.com" },
    update: {},
    create: { email: "dev@example.com", name: "Dev User" },
  });

  // Create a group with creator + owner membership
  const group = await db.group.create({
    data: {
      name: "Apartment 302",
      createdBy: user.id, // required by your schema
      members: {
        create: {
          userId: user.id,
          role: Role.OWNER, // <-- use enum, not "owner"
          // If your schema has a status enum with default, omit the field.
          // If it's required and named e.g. MemberStatus:
          // status: MemberStatus.ACTIVE,
        },
      },
    },
  });

  console.log({ user, group });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
