import type { UserRole } from "@/generated/prisma/client";

// NextAuth v5 re-exports its types from @auth/core. Module augmentation must
// target the canonical modules where the interfaces are originally declared,
// otherwise the merge happens against an unrelated symbol and TypeScript sees
// the original `unknown`-indexed shape. Augmenting both the original and the
// re-export keeps consumer imports of `next-auth` and `next-auth/jwt` typed.

declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: UserRole;
      tokenVersion?: number;
    };
  }

  interface User {
    id: string;
    role: UserRole;
    tokenVersion?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    tokenVersion?: number;
  }
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: UserRole;
      tokenVersion?: number;
    };
  }

  interface User {
    id: string;
    role: UserRole;
    tokenVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    tokenVersion?: number;
  }
}
