export type CustomerOrderStatus =
  | "inquiry"
  | "deposit_paid"
  | "preparing"
  | "scheduled_delivery"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface CustomerOrder {
  id: string;
  order_number: string;

  customer_name: string;
  customer_phone: string | null;

  status: CustomerOrderStatus;

  total_amount: string;
  deposit_amount: string;
  balance_due: string;

  scheduled_delivery_date: string | null;
  delivered_at: string | null;

  notes: string | null;

  created_at: string;
  updated_at: string;
}

export interface CustomerOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  inventory_item_id: string | null;

  sku: string;
  product_name: string;
  quantity: number;

  unit_price: string;
  discount_amount: string;
  final_price: string;

  created_at: string;
}

export interface CustomerOrderDetail extends CustomerOrder {
  items: CustomerOrderItem[];
}

export interface CustomerOrderStatusUpdateRequest {
  status: CustomerOrderStatus;
  note: string | null;
}