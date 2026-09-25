import { apiError } from "@/lib/billing-plan";
import {
  INVOICE_CALCULATION_ERROR_STATUS,
  InvoiceCalculationError,
  type InvoiceCalculationInput,
} from "@/lib/invoice-calculation";

// Shared by the invoice preview and generation routes so both accept exactly
// the same client inputs and report the same domain errors.

// Only these fields are read from the request. Every financial value, plan
// snapshot, number, date and status is derived server-side, so anything else a
// client sends (e.g. stale preview data) is ignored.
export const invoiceInputFromBody = (
  storeId: string,
  body: Record<string, unknown>
): InvoiceCalculationInput => ({
  storeId,
  billingMonthYear: body.billingMonthYear,
  billingMonthMonth: body.billingMonthMonth,
  additionalCharge: body.additionalCharge,
  discount: body.discount,
  notes: body.notes,
});

export const invoiceCalculationErrorResponse = (error: unknown) =>
  error instanceof InvoiceCalculationError
    ? apiError(INVOICE_CALCULATION_ERROR_STATUS[error.code], error.code, error.message)
    : null;
