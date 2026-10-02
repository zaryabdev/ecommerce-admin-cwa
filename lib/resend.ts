// Raw provider client. Do not send from here directly: every send path must
// first check the per-Store kill switch (lib/email/email-delivery.ts).
import { Resend } from "resend";

export function getResendClient() {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        return null;
    }

    return new Resend(apiKey);
}
