import { NextResponse } from "next/server";

import { ValidationError, readJsonObject, validationErrorResponse } from "@/lib/billing-plan";
import { invoiceCalculationErrorResponse, invoiceInputFromBody } from "@/lib/invoice-api";
import { generateAndDeliverInvoice } from "@/lib/invoice-issue";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export const dynamic = "force-dynamic";

// POST /api/super-admin/stores/:storeId/invoices
// Body: { billingMonthYear, billingMonthMonth, additionalCharge?, discount?, notes? }
// Permanently generates the Invoice for a completed UTC billing month. Every
// financial value is recalculated server-side inside the transaction from the
// Store's current plan and current orders; any other field in the body (e.g.
// figures from an earlier preview) is ignored. After the Invoice is committed the
// PDF is emailed to the Store owner; a delivery failure still returns 201 with
// emailStatus FAILED (use POST /invoices/:id/send-email to retry). No Payment.
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
      // Generation commits first; the email attempt happens afterwards and can
      // fail without affecting the 201 (see delivery / invoice.emailStatus).
      const result = await generateAndDeliverInvoice(invoiceInputFromBody(params.storeId, body));
      return NextResponse.json(result, { status: 201 });
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
