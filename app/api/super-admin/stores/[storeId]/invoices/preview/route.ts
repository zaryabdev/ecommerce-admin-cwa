import { NextResponse } from "next/server";

import { ValidationError, apiError, readJsonObject, validationErrorResponse } from "@/lib/billing-plan";
import {
  INVOICE_CALCULATION_ERROR_STATUS,
  InvoiceCalculationError,
  calculateInvoicePreview,
  serializeInvoicePreview,
} from "@/lib/invoice-calculation";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export const dynamic = "force-dynamic";

// POST /api/super-admin/stores/:storeId/invoices/preview
// Body: { billingMonthYear, billingMonthMonth, additionalCharge?, discount?, notes? }
// Calculates an invoice for the Store's CURRENT billing plan and a completed
// UTC billing month. Read-only: nothing is persisted, and the result is not a
// reservation (Generate must recalculate).
export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_INVOICE_PREVIEW_POST");
    if (denied) return denied;

    let body: Record<string, unknown>;
    try {
      body = await readJsonObject(req);
    } catch (error) {
      if (error instanceof ValidationError) return validationErrorResponse(error);
      throw error;
    }

    try {
      const calculation = await calculateInvoicePreview({
        storeId: params.storeId,
        billingMonthYear: body.billingMonthYear,
        billingMonthMonth: body.billingMonthMonth,
        additionalCharge: body.additionalCharge,
        discount: body.discount,
        notes: body.notes,
      });
      return NextResponse.json({ preview: serializeInvoicePreview(calculation) });
    } catch (error) {
      if (error instanceof InvoiceCalculationError) {
        return apiError(
          INVOICE_CALCULATION_ERROR_STATUS[error.code],
          error.code,
          error.message
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("[SUPER_ADMIN_INVOICE_PREVIEW_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
