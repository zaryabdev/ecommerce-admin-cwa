import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { requireSuperAdmin } from "@/lib/super-admin-auth";
import {
  BILLING_PLAN_SELECT,
  ValidationError,
  apiError,
  parseName,
  readJsonObject,
  resolveRule,
  serializeBillingPlan,
  validationErrorResponse,
} from "@/lib/billing-plan";

export const dynamic = "force-dynamic";

// GET /api/super-admin/billing-plans?status=all|active|archived (default: all)
export async function GET(req: Request) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_BILLING_PLANS_GET");
    if (denied) return denied;

    const status = new URL(req.url).searchParams.get("status") ?? "all";

    if (status !== "all" && status !== "active" && status !== "archived") {
      return apiError(
        400,
        "INVALID_STATUS",
        "status must be one of: all, active, archived."
      );
    }

    const plans = await prismadb.billingPlan.findMany({
      where: status === "all" ? {} : { isArchived: status === "archived" },
      select: BILLING_PLAN_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });

    return NextResponse.json({ plans: plans.map(serializeBillingPlan) });
  } catch (error) {
    console.error("[SUPER_ADMIN_BILLING_PLANS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// POST /api/super-admin/billing-plans
// Body: { name, type: "FIXED"|"PERCENTAGE", fixedAmount | percentageRate }
export async function POST(req: Request) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_BILLING_PLANS_POST");
    if (denied) return denied;

    let data;
    try {
      const body = await readJsonObject(req);
      const name = parseName(body.name);
      const rule = resolveRule(body, null);
      data = { name, ...rule };
    } catch (error) {
      if (error instanceof ValidationError) return validationErrorResponse(error);
      throw error;
    }

    const plan = await prismadb.billingPlan.create({
      data,
      select: BILLING_PLAN_SELECT,
    });

    return NextResponse.json({ plan: serializeBillingPlan(plan) }, { status: 201 });
  } catch (error) {
    console.error("[SUPER_ADMIN_BILLING_PLANS_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
