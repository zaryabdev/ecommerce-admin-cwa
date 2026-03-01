import prismadb from "@/lib/prismadb";
import { createTrackingId } from "@/lib/trackingId";
import { NextResponse } from "next/server";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

type CreateOrderPayload = {
    productIds: string[];
    paymentMethod?: "COD" | "STRIPE";
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

        const productIds = payload?.productIds ?? [];
        if (!Array.isArray(productIds) || productIds.length === 0) {
            return new NextResponse("Product ids are required", {
                status: 400,
            });
        }

        const products = await prismadb.product.findMany({
            where: { id: { in: productIds } },
            include: { size: true, color: true },
        });

        if (!products.length) {
            return new NextResponse("No products found", { status: 404 });
        }

        const totalPrice = products.reduce(
            (sum, p) => sum + Number(p.price),
            0,
        );

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

        const order = await prismadb.order.create({
            data: {
                storeId: params.storeId,
                status: "DRAFT",
                paymentMethod: payload.paymentMethod ?? "COD",
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
                    create: productIds.map((productId: string) => ({
                        product: { connect: { id: productId } },
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
