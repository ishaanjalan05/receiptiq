// src/lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },

  // If you later add a custom sign-in page at /signin, uncomment:
  // pages: { signIn: "/signin" },

  providers: [
    EmailProvider({
      // DEV: Instead of sending an email, print the magic link to the server console.
      async sendVerificationRequest({ identifier, url }) {
        console.log("\n=== Magic link for:", identifier, "===\n", url, "\n");
      },
      from: process.env.EMAIL_FROM || "noreply@local.test",
      maxAge: 60 * 60 * 24, // 24 hours
    }),
  ],

  // secret: process.env.AUTH_SECRET, // optional in dev if NEXTAUTH_SECRET is not required, but set it in prod
};
