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

export type StoreType =
  | "factory"
  | "warehouse"
  | "showroom"
  | "in_transit"
  | "online"
  | "other";

export interface InventoryItem {
  id: string;

  productId: string;
  sku: string;
  productName: string;

  category: string;
  material: string;
  color: string;

  price: number;
  cost: number;

  status: InventoryStatus;
  location: string;
  storeType: StoreType;

  condition: InventoryCondition;
  batchNumber: string;

  productionStartDate?: string;
  receivedDate?: string;
  estimatedArrivalDate?: string;
  actualArrivalDate?: string;

  reservedOrderNumber?: string;
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