import { NextResponse } from "next/server";
import { BillingPlanType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export const BILLING_PLAN_SELECT = {
  id: true,
  name: true,
  type: true,
  fixedAmount: true,
  percentageRate: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PlanRow = {
  id: string;
  name: string;
  type: BillingPlanType;
  fixedAmount: Decimal | null;
  percentageRate: Decimal | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// Decimals are serialized as plain decimal strings (never JS numbers), like
// the existing Super Admin salesTotal contract.
export const serializeBillingPlan = (plan: PlanRow) => ({
  id: plan.id,
  name: plan.name,
  type: plan.type,
  fixedAmount: plan.fixedAmount ? plan.fixedAmount.toFixed() : null,
  percentageRate: plan.percentageRate ? plan.percentageRate.toFixed() : null,
  isArchived: plan.isArchived,
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
});

export const apiError = (status: number, error: string, message: string) =>
  NextResponse.json({ error, message }, { status });

export class ValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const validationErrorResponse = (e: ValidationError) =>
  apiError(400, e.code, e.message);

export async function readJsonObject(
  req: Request
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("INVALID_JSON", "Request body must be valid JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError(
      "INVALID_BODY",
      "Request body must be a JSON object."
    );
  }
  return body as Record<string, unknown>;
}

export const has = (obj: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

const MAX_NAME_LENGTH = 255;
// Column is DECIMAL(65,30): at most 35 integer digits and 30 fractional digits.
const MAX_INTEGER_DIGITS = 35;
const MAX_FRACTION_DIGITS = 30;

export function parseName(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError("INVALID_NAME", "name is required.");
  }
  const name = value.trim();
  if (name.length > MAX_NAME_LENGTH) {
    throw new ValidationError(
      "INVALID_NAME",
      `name must be at most ${MAX_NAME_LENGTH} characters.`
    );
  }
  return name;
}

export function parseType(value: unknown): BillingPlanType {
  if (value === "FIXED" || value === "PERCENTAGE") return value;
  throw new ValidationError(
    "INVALID_TYPE",
    "type must be either FIXED or PERCENTAGE."
  );
}

// Accepts a plain decimal string ("1500", "2.5") or a finite JSON number.
// Rejects malformed input and negatives. Zero is accepted; upper bounds and
// the percentage unit are intentionally NOT enforced (not yet specified).
export function parseDecimal(field: string, value: unknown): Decimal {
  let text: string;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ValidationError("INVALID_DECIMAL", `${field} must be a valid number.`);
    }
    text = new Decimal(value).toFixed();
  } else if (typeof value === "string") {
    text = value.trim();
  } else {
    throw new ValidationError(
      "INVALID_DECIMAL",
      `${field} must be a decimal string or number.`
    );
  }

  if (text.startsWith("-")) {
    throw new ValidationError("NEGATIVE_VALUE", `${field} must not be negative.`);
  }

  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    throw new ValidationError(
      "INVALID_DECIMAL",
      `${field} must be a plain decimal number (e.g. "1500" or "2.5").`
    );
  }

  const integerDigits = match[1].replace(/^0+(?=\d)/, "").length;
  if (integerDigits > MAX_INTEGER_DIGITS || (match[2]?.length ?? 0) > MAX_FRACTION_DIGITS) {
    throw new ValidationError(
      "INVALID_DECIMAL",
      `${field} exceeds the supported precision.`
    );
  }

  return new Decimal(text);
}

export type PlanRule = {
  type: BillingPlanType;
  fixedAmount: Decimal | null;
  percentageRate: Decimal | null;
};

// Resolves the (type, fixedAmount, percentageRate) triple for create and
// update, enforcing FIXED/PERCENTAGE exclusivity. `existing` is the current
// row for updates, null for create.
export function resolveRule(
  body: Record<string, unknown>,
  existing: PlanRule | null
): PlanRule {
  const type = has(body, "type") ? parseType(body.type) : existing?.type;
  if (!type) {
    throw new ValidationError(
      "INVALID_TYPE",
      "type must be either FIXED or PERCENTAGE."
    );
  }

  const activeField = type === "FIXED" ? "fixedAmount" : "percentageRate";
  const inactiveField = type === "FIXED" ? "percentageRate" : "fixedAmount";

  if (has(body, inactiveField) && body[inactiveField] !== null) {
    throw new ValidationError(
      "CONFLICTING_RULE_FIELDS",
      `${inactiveField} must not be set on a ${type} plan.`
    );
  }

  let active: Decimal | null;
  if (has(body, activeField)) {
    if (body[activeField] === null) {
      throw new ValidationError(
        "MISSING_RULE_VALUE",
        `${activeField} is required for a ${type} plan.`
      );
    }
    active = parseDecimal(activeField, body[activeField]);
  } else if (existing && existing.type === type) {
    active = existing[activeField];
  } else {
    // Create, or switching type without supplying the new rule value.
    throw new ValidationError(
      "MISSING_RULE_VALUE",
      `${activeField} is required for a ${type} plan.`
    );
  }

  return {
    type,
    fixedAmount: type === "FIXED" ? active : null,
    percentageRate: type === "PERCENTAGE" ? active : null,
  };
}
