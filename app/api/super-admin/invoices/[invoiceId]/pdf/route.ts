import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import { InvoiceNotFoundError, generateInvoicePdf, invoicePdfResponse } from "@/lib/invoice-pdf";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export const dynamic = "force-dynamic";

// GET /api/super-admin/invoices/:invoiceId/pdf
// Renders the PDF from the persisted Invoice snapshot (no recalculation).
export async function GET(
  _req: Request,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_INVOICE_PDF_GET");
    if (denied) return denied;

    try {
      const { filename, bytes } = await generateInvoicePdf(params.invoiceId);
      return invoicePdfResponse(filename, bytes);
    } catch (error) {
      if (error instanceof InvoiceNotFoundError) {
        return apiError(404, error.code, error.message);
      }
      throw error;
    }
  } catch (error) {
    console.error("[SUPER_ADMIN_INVOICE_PDF_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
