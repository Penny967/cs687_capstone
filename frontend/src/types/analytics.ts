export type Season = "Spring" | "Summer" | "Fall" | "Winter";

export interface SalesAnalyticsRecord {
  id: string;

  orderId: string;
  orderNumber: string;
  orderItemId: string;
  inventoryItemId?: string;

  sku: string;
  productName: string;

  price: number;
  cost: number;
  sales: number;
  inventory: number;
  deliveryDays: number | null;

  category: string;
  material: string;
  color: string;
  location: string;
  season: Season;
  storeType: string;

  recordDate: string;
}