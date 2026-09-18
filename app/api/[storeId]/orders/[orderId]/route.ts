import prismadb from "@/lib/prismadb";
import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";

class InsufficientStockError extends Error {
    items: Array<{ productId: string; requested: number; available: number }>;
    constructor(items: Array<{ productId: string; requested: number; available: number }>) {
        super("Insufficient stock");
        this.items = items;
    }
}

class TransitionConflictError extends Error {
    constructor() {
        super("Order was updated concurrently");
    }
}

// Explicit, minimal Release 1 transition matrix.
// DRAFT is creation-only and is never a valid PATCH target.
// DELIVERED is reachable only from CONFIRMED and is terminal (no further
// transitions) — once goods are delivered, cancellation no longer
// auto-restores stock; returns/refunds are a separate future workflow.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    DRAFT: ["CONFIRMED", "CANCELED"],
    CONFIRMED: ["DELIVERED", "CANCELED"],
    CANCELED: ["CONFIRMED"],
    DELIVERED: [],
};

export async function PATCH(
    req: Request,
    { params }: { params: { storeId: string; orderId: string } },
) {
    try {
        const { status } = await req.json();

        if (!status || !(status in ALLOWED_TRANSITIONS)) {
            return new NextResponse("A valid status is required", { status: 400 });
        }

        const nextStatus = status as OrderStatus;

        const order = await prismadb.order.findUnique({
            where: { id: params.orderId },
            include: { orderItems: true },
        });

        if (!order) {
            return new NextResponse("Order not found", { status: 404 });
        }

        const previousStatus = order.status;

        // Idempotent no-op: a retried/double-clicked identical PATCH never
        // mutates inventory again.
        if (previousStatus === nextStatus) {
            return NextResponse.json(order);
        }

        if (!ALLOWED_TRANSITIONS[previousStatus].includes(nextStatus)) {
            return NextResponse.json(
                {
                    error: "INVALID_TRANSITION",
                    message: `Cannot move an order from ${previousStatus} to ${nextStatus}.`,
                },
                { status: 409 },
            );
        }

        // -> CONFIRMED (from DRAFT or CANCELED): atomically claim the status
        // transition and conditionally decrement stock for every line inside
        // ONE transaction. Any insufficient-stock line, or losing the claim
        // to a concurrent request, rolls back everything — never a partial
        // confirmation.
        if (nextStatus === "CONFIRMED") {
            try {
                const updatedOrder = await prismadb.$transaction(async (tx) => {
                    const claim = await tx.order.updateMany({
                        where: { id: params.orderId, status: previousStatus },
                        data: { status: "CONFIRMED" },
                    });

                    if (claim.count !== 1) {
                        throw new TransitionConflictError();
                    }

                    const failures: Array<{
                        productId: string;
                        requested: number;
                        available: number;
                    }> = [];

                    for (const item of order.orderItems) {
                        const decremented = await tx.product.updateMany({
                            where: {
                                id: item.productId,
                                storeId: order.storeId,
                                isArchived: false,
                                quantity: { gte: item.quantity },
                            },
                            data: { quantity: { decrement: item.quantity } },
                        });

                        if (decremented.count !== 1) {
                            const product = await tx.product.findUnique({
                                where: { id: item.productId },
                            });
                            failures.push({
                                productId: item.productId,
                                requested: item.quantity,
                                available: product?.quantity ?? 0,
                            });
                        }
                    }

                    if (failures.length > 0) {
                        throw new InsufficientStockError(failures);
                    }

                    return tx.order.findUniqueOrThrow({ where: { id: params.orderId } });
                });

                return NextResponse.json(updatedOrder);
            } catch (error) {
                if (error instanceof InsufficientStockError) {
                    return NextResponse.json(
                        {
                            error: "INSUFFICIENT_STOCK",
                            message:
                                "One or more products no longer have enough stock to confirm this order.",
                            items: error.items,
                        },
                        { status: 409 },
                    );
                }
                if (error instanceof TransitionConflictError) {
                    return NextResponse.json(
                        {
                            error: "CONFLICT",
                            message: "This order was updated concurrently. Please retry.",
                        },
                        { status: 409 },
                    );
                }
                throw error;
            }
        }

        // CONFIRMED -> CANCELED: atomically claim the transition and restore
        // stock for every line, exactly once, inside ONE transaction.
        if (previousStatus === "CONFIRMED" && nextStatus === "CANCELED") {
            try {
                const updatedOrder = await prismadb.$transaction(async (tx) => {
                    const claim = await tx.order.updateMany({
                        where: { id: params.orderId, status: "CONFIRMED" },
                        data: { status: "CANCELED" },
                    });

                    if (claim.count !== 1) {
                        throw new TransitionConflictError();
                    }

                    for (const item of order.orderItems) {
                        await tx.product.updateMany({
                            where: { id: item.productId, storeId: order.storeId },
                            data: { quantity: { increment: item.quantity } },
                        });
                    }

                    return tx.order.findUniqueOrThrow({ where: { id: params.orderId } });
                });

                return NextResponse.json(updatedOrder);
            } catch (error) {
                if (error instanceof TransitionConflictError) {
                    return NextResponse.json(
                        {
                            error: "CONFLICT",
                            message: "This order was updated concurrently. Please retry.",
                        },
                        { status: 409 },
                    );
                }
                throw error;
            }
        }

        // Every remaining allowed transition (DRAFT -> CANCELED,
        // CONFIRMED -> DELIVERED) has no inventory effect: a single
        // conditional status claim is enough on its own.
        const claim = await prismadb.order.updateMany({
            where: { id: params.orderId, status: previousStatus },
            data: { status: nextStatus },
        });

        if (claim.count !== 1) {
            return NextResponse.json(
                {
                    error: "CONFLICT",
                    message: "This order was updated concurrently. Please retry.",
                },
                { status: 409 },
            );
        }

        const updatedOrder = await prismadb.order.findUniqueOrThrow({
            where: { id: params.orderId },
        });

        return NextResponse.json(updatedOrder);
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
