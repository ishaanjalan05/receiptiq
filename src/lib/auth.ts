// src/lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/signin" },
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER,   // smtp.gmail.com with your app password
      from: process.env.EMAIL_FROM,       // your Gmail address
      maxAge: 60 * 60 * 24,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
};
