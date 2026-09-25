import { Decimal } from "@prisma/client/runtime/library";

// decimal.js defaults to 20 significant digits and silently rounds arithmetic
// (.plus/.times/.div) to that. Money columns are DECIMAL(65,30), so billing
// arithmetic uses a wider clone. Nothing is rounded to a business precision.
export const PreciseDecimal = Decimal.clone({ precision: 100 });
