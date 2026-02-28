import prismadb from "@/lib/prismadb";
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

export async function POST(
    req: Request,
    { params }: { params: { storeId: string } },
) {
    try {
        const { productIds } = await req.json();

        if (!productIds || productIds.length === 0) {
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

        const trackingId = randomUUID().replace(/-/g, "").slice(0, 12);

        const order = await prismadb.order.create({
            data: {
                storeId: params.storeId,
                status: "DRAFT",
                paymentMethod: "COD",
                trackingId,
                isPaid: false,
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
