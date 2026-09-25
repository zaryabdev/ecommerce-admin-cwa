import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";

// Same boundary as the existing /api/super-admin routes: 401 when
// unauthenticated, 403 for anyone but the single configured Super Admin, and
// fail closed (403) when SUPER_ADMIN_CLERK_USER_ID is missing/empty.
// Returns a response to send back on denial, or null when access is granted.
export function requireSuperAdmin(logTag: string): NextResponse | null {
  const { userId } = auth();

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const superAdminId = process.env.SUPER_ADMIN_CLERK_USER_ID?.trim();

  if (!superAdminId) {
    console.error(
      `[${logTag}] SUPER_ADMIN_CLERK_USER_ID is not configured; denying all Super Admin access`
    );
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (userId !== superAdminId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return null;
}
