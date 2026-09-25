import { deliverInvoiceEmail, type InvoiceEmailDeps } from "@/lib/invoice-email";
import { generateInvoice, serializeInvoice } from "@/lib/invoice-generation";
import type { InvoiceCalculationInput } from "@/lib/invoice-calculation";

// Release 1 "Generate & Send": permanent generation, THEN one delivery
// attempt. The generation transaction has fully committed before any PDF or
// provider work starts, so email trouble can never roll back, invalidate or
// duplicate the Invoice; the caller always gets the created Invoice back.
export async function generateAndDeliverInvoice(
  input: InvoiceCalculationInput,
  deliveryDeps?: InvoiceEmailDeps
) {
  const created = await generateInvoice(input); // commits (or throws) here

  try {
    const { invoice, delivery } = await deliverInvoiceEmail(created.id, deliveryDeps);
    return { invoice: serializeInvoice(invoice), delivery };
  } catch (error) {
    // Even delivery bookkeeping failing (e.g. DB hiccup) must not turn a
    // successful generation into an error response.
    console.error("[INVOICE_ISSUE] delivery step failed unexpectedly", error);
    return {
      invoice: serializeInvoice(created),
      delivery: {
        status: "FAILED" as const,
        error: "Email delivery could not be completed. Use Resend Email.",
      },
    };
  }
}
