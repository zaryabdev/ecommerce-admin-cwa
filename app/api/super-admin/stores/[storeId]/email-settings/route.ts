import { NextResponse } from "next/server";

import { ValidationError, apiError, validationErrorResponse } from "@/lib/billing-plan";
import { readEmailDeliveryBlockedBody } from "@/lib/email/email-delivery";
import prismadb from "@/lib/prismadb";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export const dynamic = "force-dynamic";

const storeNotFound = () => apiError(404, "STORE_NOT_FOUND", "Store not found.");

// GET /api/super-admin/stores/:storeId/email-settings
// -> { store: { id, emailDeliveryBlocked } }
export async function GET(
  _req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_STORE_EMAIL_SETTINGS_GET");
    if (denied) return denied;

    const store = await prismadb.store.findUnique({
      where: { id: params.storeId },
      select: { id: true, emailDeliveryBlocked: true },
    });
    if (!store) return storeNotFound();

    return NextResponse.json({ store });
  } catch (error) {
    console.error("[SUPER_ADMIN_STORE_EMAIL_SETTINGS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// PATCH /api/super-admin/stores/:storeId/email-settings
// Body: { emailDeliveryBlocked: boolean } -> { store: { id, emailDeliveryBlocked } }
// Same Store field the merchant controls in Admin; works for any Store.
export async function PATCH(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_STORE_EMAIL_SETTINGS_PATCH");
    if (denied) return denied;

    let emailDeliveryBlocked: boolean;
    try {
      emailDeliveryBlocked = await readEmailDeliveryBlockedBody(req);
    } catch (error) {
      if (error instanceof ValidationError) return validationErrorResponse(error);
      throw error;
    }

    const existing = await prismadb.store.findUnique({
      where: { id: params.storeId },
      select: { id: true },
    });
    if (!existing) return storeNotFound();

    const store = await prismadb.store.update({
      where: { id: existing.id },
      data: { emailDeliveryBlocked },
      select: { id: true, emailDeliveryBlocked: true },
    });

    return NextResponse.json({ store });
  } catch (error) {
    console.error("[SUPER_ADMIN_STORE_EMAIL_SETTINGS_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
