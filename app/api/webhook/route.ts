import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import prismadb from "@/lib/prismadb";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
    const body = await req.text();
    const signature = headers().get("Stripe-Signature") as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!,
        );
    } catch (error: any) {
        return new NextResponse(`Webhook Error: ${error.message}`, {
            status: 400,
        });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const details = session?.customer_details;
    const address = details?.address;

    // Legacy single-string address (keep for old UI)
    const addressComponents = [
        address?.line1,
        address?.line2,
        address?.city,
        address?.state,
        address?.postal_code,
        address?.country,
    ];
    const addressString = addressComponents.filter(Boolean).join(", ");

    if (event.type === "checkout.session.completed") {
        await prismadb.order.update({
            where: {
                id: session?.metadata?.orderId,
            },
            data: {
                isPaid: true,
                status: "CONFIRMED",

                // ✅ legacy
                address: addressString,

                // ✅ new structured fields
                phone: details?.phone || "",
                email: details?.email || "",
                customerName: details?.name || "",

                addressLine1: address?.line1 || "",
                addressLine2: address?.line2 || "",
                city: address?.city || "",
                postalCode: address?.postal_code || "",
                country: address?.country || "PK",

                // optional: keep state if you later add it
                // state: address?.state || "",
            },
            include: {
                orderItems: true,
            },
        });
    }

    return new NextResponse(null, { status: 200 });
}
