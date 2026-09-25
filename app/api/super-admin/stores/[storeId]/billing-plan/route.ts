import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { requireSuperAdmin } from "@/lib/super-admin-auth";
import {
  BILLING_PLAN_SELECT,
  ValidationError,
  apiError,
  has,
  readJsonObject,
  serializeBillingPlan,
  validationErrorResponse,
} from "@/lib/billing-plan";

export const dynamic = "force-dynamic";

const STORE_SELECT = {
  id: true,
  name: true,
  billingPlanId: true,
  billingPlan: { select: BILLING_PLAN_SELECT },
} as const;

type StoreRow = {
  id: string;
  name: string;
  billingPlanId: string | null;
  billingPlan: Parameters<typeof serializeBillingPlan>[0] | null;
};

const serializeStore = (store: StoreRow) => ({
  store: {
    id: store.id,
    name: store.name,
    billingPlanId: store.billingPlanId,
    billingPlan: store.billingPlan ? serializeBillingPlan(store.billingPlan) : null,
  },
});

const storeNotFound = () =>
  apiError(404, "STORE_NOT_FOUND", "Store not found.");

// GET /api/super-admin/stores/:storeId/billing-plan
export async function GET(
  _req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_STORE_BILLING_PLAN_GET");
    if (denied) return denied;

    const store = await prismadb.store.findUnique({
      where: { id: params.storeId },
      select: STORE_SELECT,
    });

    if (!store) return storeNotFound();

    return NextResponse.json(serializeStore(store));
  } catch (error) {
    console.error("[SUPER_ADMIN_STORE_BILLING_PLAN_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// PUT /api/super-admin/stores/:storeId/billing-plan
// Body: { billingPlanId: string | null }
// Sets the Store's single current plan; null unassigns. The key must be
// present so an omitted field can never unassign by accident. Archived plans
// cannot be newly assigned (re-sending the plan the Store already has is a
// no-op and does not count as a new assignment).
export async function PUT(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_STORE_BILLING_PLAN_PUT");
    if (denied) return denied;

    let billingPlanId: string | null;
    try {
      const body = await readJsonObject(req);
      if (!has(body, "billingPlanId")) {
        throw new ValidationError(
          "INVALID_BILLING_PLAN_ID",
          "billingPlanId is required (a plan id, or null to unassign)."
        );
      }
      const value = body.billingPlanId;
      if (value !== null && (typeof value !== "string" || value.trim() === "")) {
        throw new ValidationError(
          "INVALID_BILLING_PLAN_ID",
          "billingPlanId must be a non-empty string or null."
        );
      }
      billingPlanId = value as string | null;
    } catch (error) {
      if (error instanceof ValidationError) return validationErrorResponse(error);
      throw error;
    }

    const store = await prismadb.store.findUnique({
      where: { id: params.storeId },
      select: STORE_SELECT,
    });

    if (!store) return storeNotFound();

    if (billingPlanId !== null && billingPlanId !== store.billingPlanId) {
      const plan = await prismadb.billingPlan.findUnique({
        where: { id: billingPlanId },
        select: { id: true, isArchived: true },
      });

      if (!plan) {
        return apiError(404, "BILLING_PLAN_NOT_FOUND", "Billing plan not found.");
      }

      if (plan.isArchived) {
        return apiError(
          409,
          "BILLING_PLAN_ARCHIVED",
          "Archived billing plans cannot be assigned to a store."
        );
      }
    }

    if (billingPlanId === store.billingPlanId) {
      return NextResponse.json(serializeStore(store));
    }

    const updated = await prismadb.store.update({
      where: { id: store.id },
      data: { billingPlanId },
      select: STORE_SELECT,
    });

    return NextResponse.json(serializeStore(updated));
  } catch (error) {
    console.error("[SUPER_ADMIN_STORE_BILLING_PLAN_PUT]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
