import prismadb from "@/lib/prismadb";
import {
  ValidationError,
  readJsonObject,
  has,
} from "@/lib/billing-plan";

// Per-Store email kill switch (Store.emailDeliveryBlocked). Every email send
// path checks it server-side, immediately before delivery, via
// isStoreEmailDeliveryBlocked. A blocked Store is an intentional state, not a
// provider failure: callers must not call Resend, must not record a failed
// attempt, and must not let it affect the business operation that triggered
// the email.

export const EMAIL_DELIVERY_BLOCKED = "EMAIL_DELIVERY_BLOCKED";

export const EMAIL_DELIVERY_BLOCKED_MESSAGE =
  "Email delivery is blocked for this Store. Allow email for this Store and try again.";

// Thrown by delivery functions whose caller must be able to tell "blocked"
// apart from success or failure (invoice email).
export class EmailDeliveryBlockedError extends Error {
  code = EMAIL_DELIVERY_BLOCKED;
  constructor() {
    super(EMAIL_DELIVERY_BLOCKED_MESSAGE);
  }
}

// Fails closed: an unknown Store is treated as blocked. DB errors propagate so
// no email is sent when the setting cannot be read.
export async function isStoreEmailDeliveryBlocked(
  storeId: string,
  db: typeof prismadb = prismadb
): Promise<boolean> {
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { emailDeliveryBlocked: true },
  });
  return store ? store.emailDeliveryBlocked : true;
}

// Shared by the merchant and Super Admin endpoints:
// body must be { emailDeliveryBlocked: boolean }.
export async function readEmailDeliveryBlockedBody(req: Request): Promise<boolean> {
  const body = await readJsonObject(req);
  if (!has(body, "emailDeliveryBlocked") || typeof body.emailDeliveryBlocked !== "boolean") {
    throw new ValidationError(
      "INVALID_EMAIL_DELIVERY_BLOCKED",
      "emailDeliveryBlocked is required and must be a boolean."
    );
  }
  return body.emailDeliveryBlocked;
}
