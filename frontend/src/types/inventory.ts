export type InventoryStatus =
  | "in_production"
  | "in_transit"
  | "local_warehouse"
  | "showroom"
  | "reserved"
  | "sold"
  | "damaged"
  | "returned";

export type InventoryCondition =
  | "new"
  | "display"
  | "open_box"
  | "damaged"
  | "returned";

export interface InventoryItem {
  id: string;
  sku: string;
  productName: string;
  status: InventoryStatus;
  location: string;
  condition: InventoryCondition;
  batchNumber: string;
  reservedOrderNumber?: string;
  estimatedArrivalDate?: string;
  notes?: string;
}

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  fromStatus?: InventoryStatus;
  toStatus: InventoryStatus;
  fromLocation?: string;
  toLocation: string;
  movementReason: string;
  performedBy: string;
  createdAt: string;
}