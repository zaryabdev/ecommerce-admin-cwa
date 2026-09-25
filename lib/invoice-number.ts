import { randomBytes } from "crypto";

// Release 1 invoice numbering: INV-YYYYMM-<16 uppercase hex chars>, where
// YYYYMM is the billed month. Not sequential and not legally gap-free; the
// unique DB constraint is the final guard. Kept standalone so the policy can be
// replaced (e.g. by a real sequence) without touching calculation/persistence.
export function generateInvoiceNumber(
  billingMonthYear: number,
  billingMonthMonth: number
): string {
  const yyyymm = `${String(billingMonthYear).padStart(4, "0")}${String(billingMonthMonth).padStart(2, "0")}`;
  return `INV-${yyyymm}-${randomBytes(8).toString("hex").toUpperCase()}`;
}
