import prismadb from "@/lib/prismadb";

export const getStockCount = async (storeId: string) => {
  const stockCount = await prismadb.product.aggregate({
    where: {
      storeId,
      isArchived: false,
    },
    _sum: {
      quantity: true,
    }
  });

  return stockCount._sum.quantity ?? 0;
};
