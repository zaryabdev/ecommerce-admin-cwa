import { clerkClient } from "@clerk/nextjs/server";
import { formatter } from "@/lib/utils";
import { getResendClient } from "@/lib/resend";

type NotificationOrder = {
    trackingId: string;
    status: string;
    totalPrice: number;
    createdAt: Date;
    customerName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    postalCode: string;
    country: string;
    customerNotes: string;
    store: { name: string; userId: string };
    orderItems: Array<{
        product: {
            name: string;
            price: unknown;
            size: { name: string };
            color: { name: string };
        };
    }>;
};

const escapeHtml = (value: unknown) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const display = (value: string) => value || "—";

async function resolveRecipient(userId: string) {
    const testRecipient = process.env.RESEND_TEST_RECIPIENT?.trim();
    if (testRecipient) return testRecipient;

    const user = await clerkClient.users.getUser(userId);
    const primary = user.emailAddresses.find(
        (email) => email.id === user.primaryEmailAddressId,
    );

    return primary?.emailAddress || user.emailAddresses[0]?.emailAddress || null;
}

export async function sendNewOrderNotification(order: NotificationOrder) {
    const from = process.env.RESEND_FROM_EMAIL?.trim();
    const resend = getResendClient();

    if (!resend || !from) {
        console.warn(
            "Order notification skipped: RESEND_API_KEY and RESEND_FROM_EMAIL are required.",
        );
        return;
    }

    const recipient = await resolveRecipient(order.store.userId);
    if (!recipient) {
        throw new Error("Store owner has no usable email address");
    }

    const productsText = order.orderItems
        .map(
            ({ product }) =>
                `${product.name} | Size: ${product.size.name} | Color: ${product.color.name} | ${formatter.format(Number(product.price))}`,
        )
        .join("\n");

    const address = [
        order.addressLine1,
        order.addressLine2,
        order.city,
        order.postalCode,
        order.country,
    ]
        .filter(Boolean)
        .join(", ");

    const rows = [
        ["Store", order.store.name],
        ["Tracking ID", order.trackingId],
        ["Order date", order.createdAt.toLocaleString("en-PK")],
        ["Status", order.status],
        ["Customer name", display(order.customerName)],
        ["Customer phone", display(order.phone)],
        ["Customer email", display(order.email)],
        ["Delivery address", display(address)],
        ["Customer notes", display(order.customerNotes)],
    ];

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><h2>New Order Received</h2><table style="border-collapse:collapse;width:100%;max-width:680px">${rows
        .map(
            ([label, value]) =>
                `<tr><th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;width:180px">${escapeHtml(label)}</th><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}</table><h3>Products</h3><ul>${order.orderItems
        .map(
            ({ product }) =>
                `<li>${escapeHtml(product.name)} — Size: ${escapeHtml(product.size.name)}, Color: ${escapeHtml(product.color.name)}, ${escapeHtml(formatter.format(Number(product.price)))}</li>`,
        )
        .join("")}</ul><p><strong>Order total: ${escapeHtml(formatter.format(order.totalPrice))}</strong></p></body></html>`;

    const text = [
        "New Order Received",
        ...rows.map(([label, value]) => `${label}: ${value}`),
        "",
        "Products:",
        productsText,
        `Order total: ${formatter.format(order.totalPrice)}`,
    ].join("\n");

    await resend.emails.send({
        from,
        to: recipient,
        subject: `New Order Received — ${order.trackingId}`,
        html,
        text,
    });
}
