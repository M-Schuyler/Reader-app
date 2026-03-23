import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { isAllowedEmail } from "@/server/auth/access";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GitHub({
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile, user }) {
      return isAllowedEmail(resolveEmail(profile?.email, user.email));
    },
  },
});

function resolveEmail(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}
