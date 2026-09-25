import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { requireSuperAdmin } from "@/lib/super-admin-auth";
import {
  BILLING_PLAN_SELECT,
  ValidationError,
  apiError,
  has,
  parseName,
  readJsonObject,
  resolveRule,
  serializeBillingPlan,
  validationErrorResponse,
} from "@/lib/billing-plan";

export const dynamic = "force-dynamic";

const notFound = () =>
  apiError(404, "BILLING_PLAN_NOT_FOUND", "Billing plan not found.");

// GET /api/super-admin/billing-plans/:planId
export async function GET(
  _req: Request,
  { params }: { params: { planId: string } }
) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_BILLING_PLAN_GET");
    if (denied) return denied;

    const plan = await prismadb.billingPlan.findUnique({
      where: { id: params.planId },
      select: BILLING_PLAN_SELECT,
    });

    if (!plan) return notFound();

    return NextResponse.json({ plan: serializeBillingPlan(plan) });
  } catch (error) {
    console.error("[SUPER_ADMIN_BILLING_PLAN_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// PATCH /api/super-admin/billing-plans/:planId
// Partial update. Any of: name, type, fixedAmount, percentageRate, isArchived.
// Archiving (isArchived: true) is the only retirement mechanism; plans are
// never hard-deleted. Changing `type` requires the new type's rule value.
export async function PATCH(
  req: Request,
  { params }: { params: { planId: string } }
) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_BILLING_PLAN_PATCH");
    if (denied) return denied;

    const existing = await prismadb.billingPlan.findUnique({
      where: { id: params.planId },
      select: BILLING_PLAN_SELECT,
    });

    if (!existing) return notFound();

    let data: Record<string, unknown> = {};
    try {
      const body = await readJsonObject(req);

      if (has(body, "name")) data.name = parseName(body.name);

      if (has(body, "isArchived")) {
        if (typeof body.isArchived !== "boolean") {
          throw new ValidationError(
            "INVALID_IS_ARCHIVED",
            "isArchived must be a boolean."
          );
        }
        data.isArchived = body.isArchived;
      }

      if (has(body, "type") || has(body, "fixedAmount") || has(body, "percentageRate")) {
        Object.assign(data, resolveRule(body, existing));
      }

      if (Object.keys(data).length === 0) {
        throw new ValidationError(
          "EMPTY_UPDATE",
          "Provide at least one of: name, type, fixedAmount, percentageRate, isArchived."
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) return validationErrorResponse(error);
      throw error;
    }

    const plan = await prismadb.billingPlan.update({
      where: { id: params.planId },
      data,
      select: BILLING_PLAN_SELECT,
    });

    return NextResponse.json({ plan: serializeBillingPlan(plan) });
  } catch (error) {
    console.error("[SUPER_ADMIN_BILLING_PLAN_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
