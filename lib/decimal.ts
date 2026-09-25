import { Decimal } from "@prisma/client/runtime/library";

// decimal.js defaults to 20 significant digits and silently rounds arithmetic
// (.plus/.times/.div) to that. Money columns are DECIMAL(65,30), so billing
// arithmetic uses a wider clone. Nothing is rounded to a business precision.
export const PreciseDecimal = Decimal.clone({ precision: 100 });

// Release 1 money rule: invoice monetary components are persisted at 2 decimal
// places, ROUND_HALF_UP (10.005 -> 10.01). Applied to fee, additional charge
// and discount; eligible sales stay at their source precision.
export const MONEY_DECIMAL_PLACES = 2;

export const roundMoney = (value: Decimal.Value): Decimal =>
  new PreciseDecimal(value).toDecimalPlaces(
    MONEY_DECIMAL_PLACES,
    PreciseDecimal.ROUND_HALF_UP
  );
