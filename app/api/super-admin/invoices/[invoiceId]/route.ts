import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import { getInvoiceDetail } from "@/lib/invoice-read";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export const dynamic = "force-dynamic";

// GET /api/super-admin/invoices/:invoiceId
// The stored Invoice snapshot (+ Store name). Never recalculated.
export async function GET(
  _req: Request,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_INVOICE_GET");
    if (denied) return denied;

    const invoice = await getInvoiceDetail(params.invoiceId);
    if (!invoice) return apiError(404, "INVOICE_NOT_FOUND", "Invoice not found.");

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("[SUPER_ADMIN_INVOICE_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
