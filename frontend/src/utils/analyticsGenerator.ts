import type { SalesAnalyticsRecord } from "../types/analytics";
import type { InventoryItem } from "../types/inventory";
import type { CustomerOrder, CustomerOrderItem } from "../types/order";
import {
  calculateAvailableInventoryBySku,
  calculateDeliveryDays,
  getSeason,
} from "./analyticsUtils";

export function generateSalesAnalyticsRecords(
  orders: CustomerOrder[],
  orderItems: CustomerOrderItem[],
  inventoryItems: InventoryItem[]
): SalesAnalyticsRecord[] {
  const deliveredOrders = orders.filter(
    (order) => order.status === "delivered"
  );

  return deliveredOrders.flatMap((order) => {
    const deliveredDate =
      order.scheduledDeliveryDate || new Date().toISOString().slice(0, 10);

    const relatedOrderItems = orderItems.filter(
      (item) => item.orderId === order.id
    );

    return relatedOrderItems.map((orderItem) => {
      const linkedInventoryItem = inventoryItems.find(
        (inventoryItem) => inventoryItem.id === orderItem.inventoryItemId
      );

      const deliveryDays = calculateDeliveryDays(
        linkedInventoryItem?.productionStartDate,
        linkedInventoryItem?.actualArrivalDate
      );

      const inventory = calculateAvailableInventoryBySku(
        inventoryItems,
        orderItem.sku
      );

      return {
        id: `sales-record-${order.id}-${orderItem.id}`,

        orderId: order.id,
        orderNumber: order.orderNumber,
        orderItemId: orderItem.id,
        inventoryItemId: orderItem.inventoryItemId,

        sku: orderItem.sku,
        productName: orderItem.productName,

        price: orderItem.finalPrice,
        cost: linkedInventoryItem?.cost ?? 0,
        sales: orderItem.quantity,
        inventory,
        deliveryDays,

        category: linkedInventoryItem?.category ?? "Unknown",
        material: linkedInventoryItem?.material ?? "Unknown",
        color: linkedInventoryItem?.color ?? "Unknown",
        location: linkedInventoryItem?.location ?? "Unknown",
        season: getSeason(deliveredDate),
        storeType: linkedInventoryItem?.storeType ?? "unknown",

        recordDate: deliveredDate,
      };
    });
  });
}