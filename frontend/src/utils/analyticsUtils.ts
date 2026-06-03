import type { Season } from "../types/analytics";
import type { InventoryItem } from "../types/inventory";

export function getSeason(dateString: string): Season {
  const month = new Date(dateString).getMonth() + 1;

  if ([3, 4, 5].includes(month)) return "Spring";
  if ([6, 7, 8].includes(month)) return "Summer";
  if ([9, 10, 11].includes(month)) return "Fall";

  return "Winter";
}

export function calculateDeliveryDays(
  productionStartDate?: string,
  actualArrivalDate?: string
): number | null {
  if (!productionStartDate || !actualArrivalDate) {
    return null;
  }

  const start = new Date(productionStartDate).getTime();
  const end = new Date(actualArrivalDate).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

export function calculateAvailableInventoryBySku(
  inventoryItems: InventoryItem[],
  sku: string
): number {
  return inventoryItems.filter(
    (item) =>
      item.sku === sku &&
      ["local_warehouse", "showroom"].includes(item.status)
  ).length;
}