import { NextResponse } from "next/server";

import { apiError, has, readJsonObject, ValidationError, validationErrorResponse } from "@/lib/billing-plan";
import { serializeInvoice } from "@/lib/invoice-generation";
import { InvoiceNotFoundError } from "@/lib/invoice-pdf";
import { MARK_PAID_ERROR_STATUS, MarkPaidError, recordInvoicePayment, serializePayment } from "@/lib/payment";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export const dynamic = "force-dynamic";

const MAX_NOTES_LENGTH = 5000;

function parseNotes(body: Record<string, unknown>): string | null {
  if (!has(body, "notes") || body.notes === null || body.notes === undefined) return null;
  if (typeof body.notes !== "string") {
    throw new ValidationError("INVALID_NOTES", "notes must be a string.");
  }
  const notes = body.notes.trim();
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new ValidationError(
      "INVALID_NOTES",
      `notes must be at most ${MAX_NOTES_LENGTH} characters.`
    );
  }
  return notes === "" ? null : notes;
}

// POST /api/super-admin/invoices/:invoiceId/mark-paid
// Manual payment recording (Release 1: full payment only). The client may
// only supply optional Notes; amount is always the stored Invoice total and
// the Invoice is never re-derived from anything the caller sends. Creates
// exactly one Payment and flips Invoice.paymentStatus to PAID atomically.
export async function POST(
  req: Request,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_INVOICE_MARK_PAID_POST");
    if (denied) return denied;

    try {
      const body = await readJsonObject(req);
      const notes = parseNotes(body);

      const { invoice, payment } = await recordInvoicePayment(params.invoiceId, { notes });

      return NextResponse.json({
        invoice: serializeInvoice(invoice),
        payment: serializePayment(payment),
      });
    } catch (error) {
      if (error instanceof ValidationError) return validationErrorResponse(error);
      if (error instanceof InvoiceNotFoundError) {
        return apiError(404, error.code, error.message);
      }
      if (error instanceof MarkPaidError) {
        return apiError(MARK_PAID_ERROR_STATUS[error.code], error.code, error.message);
      }
      throw error;
    }
  } catch (error) {
    console.error("[SUPER_ADMIN_INVOICE_MARK_PAID_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
