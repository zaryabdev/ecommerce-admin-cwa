import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import { getStoreFinancialLedger } from "@/lib/financial-ledger";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Malformed or out-of-range values are normalized, never rejected (same
// convention as the Store orders / Invoice list routes).
const parsePositiveInt = (value: string | null, fallback: number) => {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
};

// GET /api/super-admin/stores/:storeId/financial-ledger?page=&pageSize=
// Derived at query time from Invoice (debit) + Payment (credit) rows only;
// never from Invoice.paymentStatus and never from a persisted ledger table.
export async function GET(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_STORE_FINANCIAL_LEDGER_GET");
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(
      parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );

    const ledger = await getStoreFinancialLedger({ storeId: params.storeId, page, pageSize });
    if (!ledger) return apiError(404, "STORE_NOT_FOUND", "Store not found.");

    return NextResponse.json(ledger);
  } catch (error) {
    console.error("[SUPER_ADMIN_STORE_FINANCIAL_LEDGER_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
