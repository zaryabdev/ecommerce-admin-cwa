import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import { deliverInvoiceEmail } from "@/lib/invoice-email";
import { serializeInvoice } from "@/lib/invoice-generation";
import { InvoiceNotFoundError } from "@/lib/invoice-pdf";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export const dynamic = "force-dynamic";

// POST /api/super-admin/invoices/:invoiceId/send-email
// (Re)sends the PDF of an EXISTING Invoice to the Store owner. Never creates
// an Invoice and never touches financial fields; only email-delivery state is
// updated. Allowed for NOT_SENT, FAILED and SENT (deliberate re-send).
// 200 on success; 502 EMAIL_DELIVERY_FAILED if the attempt failed (the Invoice
// already records emailStatus FAILED and the attempt metadata).
export async function POST(
  _req: Request,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_INVOICE_SEND_EMAIL_POST");
    if (denied) return denied;

    try {
      const { invoice, delivery } = await deliverInvoiceEmail(params.invoiceId);
      const serialized = serializeInvoice(invoice);

      if (delivery.status === "FAILED") {
        return NextResponse.json(
          {
            error: "EMAIL_DELIVERY_FAILED",
            message: delivery.error ?? "Email delivery failed.",
            invoice: serialized,
            delivery,
          },
          { status: 502 }
        );
      }
      return NextResponse.json({ invoice: serialized, delivery });
    } catch (error) {
      if (error instanceof InvoiceNotFoundError) {
        return apiError(404, error.code, error.message);
      }
      throw error;
    }
  } catch (error) {
    console.error("[SUPER_ADMIN_INVOICE_SEND_EMAIL_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
