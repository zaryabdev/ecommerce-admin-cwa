import prismadb from "@/lib/prismadb";
import { createTrackingId } from "@/lib/trackingId";
import { NextResponse } from "next/server";
import { sendNewOrderNotification } from "@/lib/email/send-new-order-notification";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

type OrderLineInput = {
    productId: string;
    quantity: number;
};

type CreateOrderPayload = {
    items: OrderLineInput[];
    paymentMethod?: "COD";
    customer?: {
        name?: string;
        phone?: string;
        email?: string;
    };
    shipping?: {
        line1?: string;
        line2?: string;
        city?: string;
        postalCode?: string;
        country?: string; // "PK"
        notes?: string;
    };
    notes?: string;
};

function buildAddressString(payload: CreateOrderPayload) {
    const parts: string[] = [];
    const s = payload.shipping;

    if (s?.line1) parts.push(s.line1);
    if (s?.line2) parts.push(s.line2);

    const cityLine = [s?.city, s?.postalCode].filter(Boolean).join(" ");
    if (cityLine) parts.push(cityLine);

    if (s?.country) parts.push(s.country);

    return parts.join(", ");
}

export async function POST(
    req: Request,
    { params }: { params: { storeId: string } },
) {
    try {
        const payload = (await req.json()) as CreateOrderPayload;

        const items = payload?.items ?? [];
        if (!Array.isArray(items) || items.length === 0) {
            return new NextResponse("Items are required", {
                status: 400,
            });
        }

        for (const item of items) {
            if (
                !item ||
                typeof item.productId !== "string" ||
                !item.productId ||
                typeof item.quantity !== "number" ||
                !Number.isInteger(item.quantity) ||
                item.quantity < 1
            ) {
                return NextResponse.json(
                    {
                        error: "INVALID_ITEM",
                        message: "Each item requires a valid productId and a positive integer quantity.",
                    },
                    { status: 400, headers: corsHeaders },
                );
            }
        }

        const productIds = items.map((item) => item.productId);

        const products = await prismadb.product.findMany({
            where: { id: { in: productIds }, storeId: params.storeId },
            include: { size: true, color: true },
        });

        const productsById = new Map(products.map((p) => [p.id, p]));

        const unavailable: Array<{
            productId: string;
            reason: "NOT_FOUND" | "ARCHIVED" | "INSUFFICIENT_STOCK";
            requested: number;
            available?: number;
        }> = [];

        for (const item of items) {
            const product = productsById.get(item.productId);

            if (!product) {
                unavailable.push({
                    productId: item.productId,
                    reason: "NOT_FOUND",
                    requested: item.quantity,
                });
                continue;
            }

            if (product.isArchived) {
                unavailable.push({
                    productId: item.productId,
                    reason: "ARCHIVED",
                    requested: item.quantity,
                });
                continue;
            }

            if (item.quantity > product.quantity) {
                unavailable.push({
                    productId: item.productId,
                    reason: "INSUFFICIENT_STOCK",
                    requested: item.quantity,
                    available: product.quantity,
                });
            }
        }

        if (unavailable.length > 0) {
            return NextResponse.json(
                {
                    error: "ORDER_NOT_PLACEABLE",
                    message: "One or more items are unavailable in the requested quantity.",
                    items: unavailable,
                },
                { status: 400, headers: corsHeaders },
            );
        }

        const totalPrice = items.reduce((sum, item) => {
            const product = productsById.get(item.productId)!;
            return sum + Number(product.price) * item.quantity;
        }, 0);

        const trackingId = createTrackingId();

        // ✅ normalize + fallbacks
        const customerName = payload.customer?.name?.trim() ?? "";
        const email = payload.customer?.email?.trim() ?? "";
        const phone = payload.customer?.phone?.trim() ?? "";

        const addressLine1 = payload.shipping?.line1?.trim() ?? "";
        const addressLine2 = payload.shipping?.line2?.trim() ?? "";
        const city = payload.shipping?.city?.trim() ?? "";
        const postalCode = payload.shipping?.postalCode?.trim() ?? "";
        const country = (payload.shipping?.country?.trim() ?? "PK") || "PK";

        const customerNotes = (
            payload.shipping?.notes ??
            payload.notes ??
            ""
        ).trim();

        // keep this for backward compatibility / display
        const address = buildAddressString(payload);

        // Order creation only records the request — it never adjusts
        // Product.quantity. Stock is committed atomically when an Admin
        // confirms the order (see app/api/[storeId]/orders/[orderId]/route.ts).
        const order = await prismadb.order.create({
            data: {
                storeId: params.storeId,
                status: "DRAFT",
                paymentMethod: "COD",
                trackingId,
                isPaid: false,

                // ✅ NEW: persist to actual columns
                customerName,
                email,
                phone,

                addressLine1,
                addressLine2,
                city,
                postalCode,
                country,
                customerNotes,

                // optional legacy display field
                address,

                orderItems: {
                    create: items.map((item) => ({
                        quantity: item.quantity,
                        product: { connect: { id: item.productId } },
                    })),
                },
            },
            include: {
                orderItems: {
                    include: {
                        product: { include: { size: true, color: true } },
                    },
                },
                store: true,
            },
        });

        try {
            await sendNewOrderNotification({
                ...order,
                totalPrice,
            });
        } catch (notificationError) {
            console.error("Order notification failed", notificationError);
        }

        return NextResponse.json(
            {
                orderId: order.id,
                trackingId,
                status: order.status,
                paymentMethod: order.paymentMethod,

                // ✅ return the structured fields too
                customerName: order.customerName,
                email: order.email,
                phone: order.phone,

                addressLine1: order.addressLine1,
                addressLine2: order.addressLine2,
                city: order.city,
                postalCode: order.postalCode,
                country: order.country,
                customerNotes: order.customerNotes,

                // keep old one if your UI still uses it
                address: order.address,

                products: order.orderItems.map((item) => ({
                    id: item.product.id,
                    name: item.product.name,
                    price: item.product.price,
                    quantity: item.quantity,
                    size: item.product.size,
                    color: item.product.color,
                })),
                totalPrice,
                store: { id: order.store.id, name: order.store.name },
            },
            { headers: corsHeaders },
        );
    } catch (error: any) {
        return new NextResponse(error.message ?? "Server error", {
            status: 500,
        });
    }
}
