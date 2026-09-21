import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { Decimal } from "@prisma/client/runtime/library";

import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

const DEFAULT_CURRENCY = "PKR";
// salesTotal counts only accepted orders. DRAFT and CANCELED are excluded.
const SALES_STATUSES = ["CONFIRMED", "DELIVERED"] as const;

export async function GET() {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const superAdminId = process.env.SUPER_ADMIN_CLERK_USER_ID?.trim();

    if (!superAdminId) {
      console.error(
        "[SUPER_ADMIN_STORES_GET] SUPER_ADMIN_CLERK_USER_ID is not configured; denying all Super Admin access"
      );
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (userId !== superAdminId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // 1. All stores with their total order count (every status).
    // 2. Snapshot totals for qualifying orders, grouped by store + currency.
    // 3. Legacy qualifying orders (total IS NULL) for the product-price fallback.
    const [stores, snapshotGroups, legacyOrders] = await Promise.all([
      prismadb.store.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prismadb.order.groupBy({
        by: ["storeId", "currency"],
        where: {
          status: { in: [...SALES_STATUSES] },
          total: { not: null },
        },
        _sum: { total: true },
      }),
      prismadb.order.findMany({
        where: {
          status: { in: [...SALES_STATUSES] },
          total: null,
        },
        select: {
          storeId: true,
          currency: true,
          orderItems: {
            select: {
              quantity: true,
              product: { select: { price: true } },
            },
          },
        },
      }),
    ]);

    // storeId -> currency -> running decimal total
    const totals = new Map<string, Map<string, Decimal>>();

    const addTotal = (
      storeId: string,
      currency: string | null,
      amount: Decimal
    ) => {
      const code = currency ?? DEFAULT_CURRENCY;
      let byCurrency = totals.get(storeId);
      if (!byCurrency) {
        byCurrency = new Map();
        totals.set(storeId, byCurrency);
      }
      byCurrency.set(code, (byCurrency.get(code) ?? new Decimal(0)).plus(amount));
    };

    for (const group of snapshotGroups) {
      addTotal(
        group.storeId,
        group.currency,
        new Decimal(group._sum.total ?? 0)
      );
    }

    // Legacy fallback: same policy as the merchant dashboard
    // (Product.price x OrderItem.quantity), but in Decimal arithmetic.
    for (const order of legacyOrders) {
      const orderTotal = order.orderItems.reduce(
        (sum, item) =>
          sum.plus(new Decimal(item.product.price).times(item.quantity)),
        new Decimal(0)
      );
      addTotal(order.storeId, order.currency, orderTotal);
    }

    const result = stores.map((store) => {
      const byCurrency = totals.get(store.id);

      if (byCurrency && byCurrency.size > 1) {
        // Never silently sum incompatible currencies.
        throw new Error(
          `Mixed currencies in store ${store.id}: ${Array.from(byCurrency.keys()).join(", ")}`
        );
      }

      const [currency, salesTotal] = byCurrency
        ? Array.from(byCurrency.entries())[0]
        : [DEFAULT_CURRENCY, new Decimal(0)];

      return {
        id: store.id,
        name: store.name,
        createdAt: store.createdAt,
        orderCount: store._count.orders,
        salesTotal: salesTotal.toFixed(),
        currency,
      };
    });

    return NextResponse.json({ stores: result });
  } catch (error) {
    console.error("[SUPER_ADMIN_STORES_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
