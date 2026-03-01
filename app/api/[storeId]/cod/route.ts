import prismadb from "@/lib/prismadb";
import { createTrackingId } from "@/lib/trackingId";
import { randomUUID } from "crypto";
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

    // optional notes
    const note = s?.notes || payload.notes;
    if (note) parts.push(`Notes: ${note}`);

    // optional customer name/email (until schema has real fields)
    const c = payload.customer;
    const identity = [c?.name, c?.email].filter(Boolean).join(" • ");
    if (identity) parts.push(`Customer: ${identity}`);

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

        // Optional: basic COD validation (keep minimal for now)
        // If you want, make these required:
        // - payload.customer.phone
        // - payload.shipping.line1
        // - payload.shipping.city
        const phone = payload.customer?.phone?.trim() ?? "";
        const address = buildAddressString(payload);

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

        const order = await prismadb.order.create({
            data: {
                storeId: params.storeId,
                status: "DRAFT",
                paymentMethod: "COD",
                trackingId,
                isPaid: false,

                // ✅ persist what schema supports today
                phone,
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
                // return back what UI needs
                phone: order.phone,
                address: order.address,
                products: order.orderItems.map((item) => ({
                    id: item.product.id,
                    name: item.product.name,
                    price: item.product.price,
                    size: item.product.size,
                    color: item.product.color,
                })),
                totalPrice,
                store: {
                    id: order.store.id,
                    name: order.store.name,
                },
            },
            { headers: corsHeaders },
        );
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
