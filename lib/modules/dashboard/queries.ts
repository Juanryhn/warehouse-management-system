import "server-only";
import { getRequestCollections } from "@/lib/db/request";
import { requireUser } from "@/lib/auth/session";

export const getKpis = async () => {
  await requireUser();
  const { products, stockLevels, receipts, orders, stockMovements } = await getRequestCollections();

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [skuCount, openReceipts, openOrders, movementsToday, lowStock] = await Promise.all([
    products.countDocuments({ isActive: true }),
    receipts.countDocuments({ status: { $in: ["draft", "partial"] } }),
    orders.countDocuments({ status: { $in: ["draft", "allocated", "picked", "packed"] } }),
    stockMovements.countDocuments({ createdAt: { $gte: startOfDay } }),
    stockLevels
      .aggregate<{ _id: string; onHand: number }>([
        { $group: { _id: "$productId", onHand: { $sum: "$onHand" } } },
        { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
        { $unwind: "$product" },
        { $match: { $expr: { $lt: ["$onHand", "$product.minStock"] } } },
      ])
      .toArray(),
  ]);

  return { skuCount, lowStock: lowStock.length, openReceipts, openOrders, movementsToday };
};
