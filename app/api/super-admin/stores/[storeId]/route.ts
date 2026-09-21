import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs";
import { Decimal } from "@prisma/client/runtime/library";

import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

// Keep in sync with app/api/super-admin/stores/route.ts (list) so list and
// detail metrics never drift.
const DEFAULT_CURRENCY = "PKR";
// salesTotal counts only accepted orders. DRAFT and CANCELED are excluded.
const SALES_STATUSES = ["CONFIRMED", "DELIVERED"] as const;

async function getOwner(userId: string) {
  try {
    const user = await clerkClient.users.getUser(userId);
    const primary = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId
    );

    return {
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null,
    };
  } catch (error) {
    // Owner may be deleted in Clerk; the Store detail should still load.
    console.error("[SUPER_ADMIN_STORE_GET] owner lookup failed", error);
    return { userId, firstName: null, lastName: null, email: null };
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const superAdminId = process.env.SUPER_ADMIN_CLERK_USER_ID?.trim();

    if (!superAdminId) {
      console.error(
        "[SUPER_ADMIN_STORE_GET] SUPER_ADMIN_CLERK_USER_ID is not configured; denying all Super Admin access"
      );
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (userId !== superAdminId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const store = await prismadb.store.findUnique({
      where: { id: params.storeId },
      select: {
        id: true,
        name: true,
        userId: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    });

    if (!store) {
      return new NextResponse("Store not found", { status: 404 });
    }

    const [snapshotGroups, legacyOrders, owner] = await Promise.all([
      prismadb.order.groupBy({
        by: ["currency"],
        where: {
          storeId: store.id,
          status: { in: [...SALES_STATUSES] },
          total: { not: null },
        },
        _sum: { total: true },
      }),
      prismadb.order.findMany({
        where: {
          storeId: store.id,
          status: { in: [...SALES_STATUSES] },
          total: null,
        },
        select: {
          currency: true,
          orderItems: {
            select: {
              quantity: true,
              product: { select: { price: true } },
            },
          },
        },
      }),
      getOwner(store.userId),
    ]);

    const totals = new Map<string, Decimal>();

    const addTotal = (currency: string | null, amount: Decimal) => {
      const code = currency ?? DEFAULT_CURRENCY;
      totals.set(code, (totals.get(code) ?? new Decimal(0)).plus(amount));
    };

    for (const group of snapshotGroups) {
      addTotal(group.currency, new Decimal(group._sum.total ?? 0));
    }

    // Legacy fallback (total IS NULL only): Product.price x quantity, Decimal.
    for (const order of legacyOrders) {
      const orderTotal = order.orderItems.reduce(
        (sum, item) =>
          sum.plus(new Decimal(item.product.price).times(item.quantity)),
        new Decimal(0)
      );
      addTotal(order.currency, orderTotal);
    }

    if (totals.size > 1) {
      // Never silently sum incompatible currencies.
      throw new Error(
        `Mixed currencies in store ${store.id}: ${Array.from(totals.keys()).join(", ")}`
      );
    }

    const [currency, salesTotal] = totals.size
      ? Array.from(totals.entries())[0]
      : [DEFAULT_CURRENCY, new Decimal(0)];

    return NextResponse.json({
      store: {
        id: store.id,
        name: store.name,
        createdAt: store.createdAt,
        orderCount: store._count.orders,
        salesTotal: salesTotal.toFixed(),
        currency,
        owner,
      },
    });
  } catch (error) {
    console.error("[SUPER_ADMIN_STORE_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
