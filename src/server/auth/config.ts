import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Custom JWT claims (next-auth/jwt isn't resolvable for module augmentation under pnpm).
type AppToken = { id: string; role: Role; departmentId: string | null };

const PUBLIC_PATHS = ["/login", "/api/health", "/api/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Edge-safe config (no Prisma/bcrypt) shared by middleware and the full Auth.js instance.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname === "/login" && auth?.user) {
        return Response.redirect(new URL("/", request.nextUrl));
      }
      if (isPublic(pathname)) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.departmentId = user.departmentId;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as typeof token & AppToken;
      session.user.id = t.id;
      session.user.role = t.role;
      session.user.departmentId = t.departmentId;
      session.user.name = t.name ?? "";
      return session;
    },
  },
} satisfies NextAuthConfig;

declare module "next-auth" {
  interface User {
    role: Role;
    departmentId: string | null;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      departmentId: string | null;
    };
  }
}
