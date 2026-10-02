import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { ValidationError, apiError, validationErrorResponse } from "@/lib/billing-plan";
import { readEmailDeliveryBlockedBody } from "@/lib/email/email-delivery";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

// Merchant-owned, authenticated. The setting is private: it is never part of
// the public Storefront Store read (GET /api/stores/:storeId).
// 401 unauthenticated, 404 unknown Store, 403 Store owned by someone else.
async function loadOwnedStore(storeId: string) {
  const { userId } = auth();
  if (!userId) return { store: null, denied: new NextResponse("Unauthenticated", { status: 401 }) };

  const store = await prismadb.store.findUnique({
    where: { id: storeId },
    select: { id: true, userId: true, emailDeliveryBlocked: true },
  });
  if (!store) return { store: null, denied: apiError(404, "STORE_NOT_FOUND", "Store not found.") };
  if (store.userId !== userId) return { store: null, denied: new NextResponse("Forbidden", { status: 403 }) };

  return { store, denied: null };
}

// GET /api/stores/:storeId/email-settings -> { emailDeliveryBlocked }
export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    return NextResponse.json({ emailDeliveryBlocked: store.emailDeliveryBlocked });
  } catch (error) {
    console.error("[STORE_EMAIL_SETTINGS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// PATCH /api/stores/:storeId/email-settings
// Body: { emailDeliveryBlocked: boolean } -> { emailDeliveryBlocked }
export async function PATCH(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    let emailDeliveryBlocked: boolean;
    try {
      emailDeliveryBlocked = await readEmailDeliveryBlockedBody(req);
    } catch (error) {
      if (error instanceof ValidationError) return validationErrorResponse(error);
      throw error;
    }

    const updated = await prismadb.store.update({
      where: { id: store.id },
      data: { emailDeliveryBlocked },
      select: { emailDeliveryBlocked: true },
    });

    return NextResponse.json({ emailDeliveryBlocked: updated.emailDeliveryBlocked });
  } catch (error) {
    console.error("[STORE_EMAIL_SETTINGS_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
