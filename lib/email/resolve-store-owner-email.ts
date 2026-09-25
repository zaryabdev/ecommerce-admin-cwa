import { clerkClient } from "@clerk/nextjs/server";

// Store owner's email: RESEND_TEST_RECIPIENT override (dev safety, existing
// convention), else the owner's primary Clerk email, else their first one.
// Shared by the new-order notification and invoice delivery.
export async function resolveStoreOwnerEmail(userId: string) {
    const testRecipient = process.env.RESEND_TEST_RECIPIENT?.trim();
    if (testRecipient) return testRecipient;

    const user = await clerkClient.users.getUser(userId);
    const primary = user.emailAddresses.find(
        (email) => email.id === user.primaryEmailAddressId,
    );

    return primary?.emailAddress || user.emailAddresses[0]?.emailAddress || null;
}
