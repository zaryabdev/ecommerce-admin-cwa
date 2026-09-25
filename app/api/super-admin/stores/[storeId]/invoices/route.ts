import { NextResponse } from "next/server";

import { ValidationError, readJsonObject, validationErrorResponse } from "@/lib/billing-plan";
import { invoiceCalculationErrorResponse, invoiceInputFromBody } from "@/lib/invoice-api";
import { generateInvoice, serializeInvoice } from "@/lib/invoice-generation";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export const dynamic = "force-dynamic";

// POST /api/super-admin/stores/:storeId/invoices
// Body: { billingMonthYear, billingMonthMonth, additionalCharge?, discount?, notes? }
// Permanently generates the Invoice for a completed UTC billing month. Every
// financial value is recalculated server-side inside the transaction from the
// Store's current plan and current orders; any other field in the body (e.g.
// figures from an earlier preview) is ignored. No PDF, email or Payment.
export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_INVOICE_POST");
    if (denied) return denied;

    let body: Record<string, unknown>;
    try {
      body = await readJsonObject(req);
    } catch (error) {
      if (error instanceof ValidationError) return validationErrorResponse(error);
      throw error;
    }

    try {
      const invoice = await generateInvoice(invoiceInputFromBody(params.storeId, body));
      return NextResponse.json({ invoice: serializeInvoice(invoice) }, { status: 201 });
    } catch (error) {
      const response = invoiceCalculationErrorResponse(error);
      if (response) return response;
      throw error;
    }
  } catch (error) {
    console.error("[SUPER_ADMIN_INVOICE_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
