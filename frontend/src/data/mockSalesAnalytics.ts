import { mockInventory } from "./mockInventory";
import { mockOrderItems, mockOrders } from "./mockOrders";
import { generateSalesAnalyticsRecords } from "../utils/analyticsGenerator";

export const mockSalesAnalyticsRecords = generateSalesAnalyticsRecords(
  mockOrders,
  mockOrderItems,
  mockInventory
);