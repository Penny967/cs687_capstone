export type OrderStatus =
  | "inquiry"
  | "deposit_paid"
  | "preparing"
  | "scheduled_delivery"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  totalAmount: number;
  depositAmount: number;
  balanceDue: number;
  scheduledDeliveryDate?: string;
  createdAt: string;
  notes?: string;
}

export interface CustomerOrderItem {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  finalPrice: number;
  inventoryItemId?: string;
}
