import { NextResponse } from "next/server";

import {
  INVOICE_DEFAULT_PAGE_SIZE,
  INVOICE_MAX_PAGE_SIZE,
  listInvoices,
} from "@/lib/invoice-read";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export const dynamic = "force-dynamic";

// Malformed or out-of-range values are normalized, never rejected (same
// convention as the Store orders route).
const parsePositiveInt = (value: string | null, fallback: number) => {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
};

// GET /api/super-admin/invoices?storeId=&page=&pageSize=
// Newest first. Reads persisted Invoices only; no recalculation.
export async function GET(req: Request) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_INVOICES_GET");
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId")?.trim() || undefined;
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(
      parsePositiveInt(searchParams.get("pageSize"), INVOICE_DEFAULT_PAGE_SIZE),
      INVOICE_MAX_PAGE_SIZE
    );

    return NextResponse.json(await listInvoices({ storeId, page, pageSize }));
  } catch (error) {
    console.error("[SUPER_ADMIN_INVOICES_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
