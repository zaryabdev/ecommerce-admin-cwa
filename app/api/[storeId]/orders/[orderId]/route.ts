import prismadb from "@/lib/prismadb";
import { NextResponse } from "next/server";

export async function PATCH(
    req: Request,
    { params }: { params: { storeId: string; orderId: string } },
) {
    try {
        const { status } = await req.json();

        if (!status) {
            return new NextResponse("Status is required", { status: 400 });
        }

        // Fetch existing order with products
        const order = await prismadb.order.findUnique({
            where: { id: params.orderId },
            include: {
                orderItems: true,
            },
        });

        if (!order) {
            return new NextResponse("Order not found", { status: 404 });
        }

        const previousStatus = order.status;

        // Update order status
        const updatedOrder = await prismadb.order.update({
            where: { id: params.orderId },
            data: { status },
        });

        const productIds = order.orderItems.map((item) => item.productId);

        // 🔥 Inventory Logic
        // Only trigger when status changes

        // If moving to CONFIRMED → archive products
        if (previousStatus !== "CONFIRMED" && status === "CONFIRMED") {
            await prismadb.product.updateMany({
                where: { id: { in: productIds } },
                data: { isArchived: true },
            });
        }

        // If moving to CANCELED → restore products
        if (previousStatus === "CONFIRMED" && status === "CANCELED") {
            await prismadb.product.updateMany({
                where: { id: { in: productIds } },
                data: { isArchived: false },
            });
        }

        return NextResponse.json(updatedOrder);
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
