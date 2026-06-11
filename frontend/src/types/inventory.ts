export type InventoryStatus =
  | "in_production"
  | "in_transit"
  | "local_warehouse"
  | "showroom"
  | "reserved"
  | "sold"
  | "damaged"
  | "returned";

export interface InventoryItem {
  id: string;
  product_id: string;

  sku: string;
  product_name: string;
  category: string;
  material: string;
  color: string;

  status: InventoryStatus;
  location: string;
  store_type: string;
  condition: string;

  batch_number: string | null;

  unit_cost: string | null;
  expected_selling_price: string | null;

  production_start_date: string | null;
  estimated_arrival_date: string | null;
  actual_arrival_date: string | null;
  received_date: string | null;

  reserved_order_id: string | null;
  notes: string | null;

  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  inventory_item_id: string;

  from_status: InventoryStatus | null;
  to_status: InventoryStatus;

  from_location: string | null;
  to_location: string | null;

  movement_reason: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface InventoryItemCreateRequest {
  product_id: string;

  status: InventoryStatus;
  location: string;
  store_type: string;
  condition: string;

  batch_number: string | null;

  unit_cost: number | null;
  expected_selling_price: number | null;

  production_start_date: string | null;
  estimated_arrival_date: string | null;
  actual_arrival_date: string | null;
  received_date: string | null;

  notes: string | null;
}

export interface InventoryStatusUpdateRequest {
  status: InventoryStatus;
  location?: string;
  store_type?: string;
  movement_reason?: string;
}