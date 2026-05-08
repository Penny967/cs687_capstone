import { useState } from "react";

import { mockOrderItems, mockOrders } from "../data/mockOrders";
import type { CustomerOrder, CustomerOrderItem, OrderStatus } from "../types/order";

type OrderStatusFilter = "all" | OrderStatus;

const orderStatusLabels: Record<OrderStatus, string> = {
  inquiry: "Inquiry",
  deposit_paid: "Deposit Paid",
  preparing: "Preparing",
  scheduled_delivery: "Scheduled Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const orderStatusClassNames: Record<OrderStatus, string> = {
  inquiry: "badge badge-blue",
  deposit_paid: "badge badge-purple",
  preparing: "badge badge-yellow",
  scheduled_delivery: "badge badge-orange",
  delivered: "badge badge-green",
  cancelled: "badge badge-gray",
  refunded: "badge badge-red",
};

const orderStatusOptions: { value: OrderStatusFilter; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "inquiry", label: "Inquiry" },
  { value: "deposit_paid", label: "Deposit Paid" },
  { value: "preparing", label: "Preparing" },
  { value: "scheduled_delivery", label: "Scheduled Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

const orderStatusUpdateOptions: { value: OrderStatus; label: string }[] = [
  { value: "inquiry", label: "Inquiry" },
  { value: "deposit_paid", label: "Deposit Paid" },
  { value: "preparing", label: "Preparing" },
  { value: "scheduled_delivery", label: "Scheduled Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function OrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>(mockOrders);

  const [selectedStatus, setSelectedStatus] =
    useState<OrderStatusFilter>("all");

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);

  const [detailOrder, setDetailOrder] = useState<CustomerOrder | null>(null);

  const [newOrderStatus, setNewOrderStatus] =
    useState<OrderStatus>("inquiry");

  const [statusNote, setStatusNote] = useState("");

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredOrders = orders.filter((order) => {
    const matchesStatus =
      selectedStatus === "all" || order.status === selectedStatus;

    const matchesSearch =
      normalizedSearchTerm === "" ||
      order.orderNumber.toLowerCase().includes(normalizedSearchTerm) ||
      order.customerName.toLowerCase().includes(normalizedSearchTerm) ||
      order.customerPhone.toLowerCase().includes(normalizedSearchTerm);

    return matchesStatus && matchesSearch;
  });

  const activeOrdersCount = orders.filter(
    (order) =>
      order.status !== "delivered" &&
      order.status !== "cancelled" &&
      order.status !== "refunded"
  ).length;

  const deliveredOrdersCount = orders.filter(
    (order) => order.status === "delivered"
  ).length;

  const totalRevenue = orders
    .filter((order) => order.status === "delivered")
    .reduce((sum, order) => sum + order.totalAmount, 0);

  const totalBalanceDue = orders.reduce(
    (sum, order) => sum + order.balanceDue,
    0
  );

  const detailOrderItems: CustomerOrderItem[] = detailOrder
    ? mockOrderItems.filter((item) => item.orderId === detailOrder.id)
    : [];

  function openStatusModal(order: CustomerOrder) {
    setSelectedOrder(order);
    setNewOrderStatus(order.status);
    setStatusNote("");
  }

  function closeStatusModal() {
    setSelectedOrder(null);
    setStatusNote("");
  }

  function openDetailModal(order: CustomerOrder) {
    setDetailOrder(order);
  }

  function closeDetailModal() {
    setDetailOrder(null);
  }

  function handleSaveOrderStatus() {
    if (!selectedOrder) {
      return;
    }

    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.id !== selectedOrder.id) {
          return order;
        }

        const isDelivered = newOrderStatus === "delivered";

        return {
          ...order,
          status: newOrderStatus,
          balanceDue: isDelivered ? 0 : order.balanceDue,
          notes: statusNote.trim() || order.notes,
        };
      })
    );

    closeStatusModal();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Customer Orders</h2>
          <p>
            Track customer orders from inquiry, deposit, preparation, scheduled
            delivery, and final delivery.
          </p>
        </div>

        <button className="primary-button">Add Order</button>
      </div>

      <div className="inventory-summary-grid">
        <div className="summary-card">
          <span className="summary-label">Total Orders</span>
          <strong>{orders.length}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Active Orders</span>
          <strong>{activeOrdersCount}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Delivered</span>
          <strong>{deliveredOrdersCount}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Balance Due</span>
          <strong>{formatCurrency(totalBalanceDue)}</strong>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div>
            <h3>Order List</h3>
            <p>
              Showing {filteredOrders.length} of {orders.length} orders.
              Delivered revenue: {formatCurrency(totalRevenue)}.
            </p>
          </div>

          <div className="table-actions">
            <div className="search-group">
              <label htmlFor="order-search">Search</label>
              <input
                id="order-search"
                type="text"
                placeholder="Search order, customer, phone..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="order-status-filter">Status</label>
              <select
                id="order-status-filter"
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(event.target.value as OrderStatusFilter)
                }
              >
                {orderStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Total</th>
              <th>Deposit</th>
              <th>Balance Due</th>
              <th>Scheduled Delivery</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.orderNumber}</td>
                <td>{order.customerName}</td>
                <td>{order.customerPhone}</td>
                <td>
                  <span className={orderStatusClassNames[order.status]}>
                    {orderStatusLabels[order.status]}
                  </span>
                </td>
                <td>{formatCurrency(order.totalAmount)}</td>
                <td>{formatCurrency(order.depositAmount)}</td>
                <td>{formatCurrency(order.balanceDue)}</td>
                <td>{order.scheduledDeliveryDate ?? "-"}</td>
                <td>{order.createdAt}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="secondary-button"
                      onClick={() => openDetailModal(order)}
                    >
                      View Details
                    </button>

                    <button
                      className="secondary-button"
                      onClick={() => openStatusModal(order)}
                    >
                      Update Status
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-table-message">
                  No customer orders match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Update Order Status</h3>
                <p>
                  {selectedOrder.orderNumber} · {selectedOrder.customerName}
                </p>
              </div>

              <button className="icon-button" onClick={closeStatusModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-row">
                <span>Current Status</span>
                <strong>{orderStatusLabels[selectedOrder.status]}</strong>
              </div>

              <div className="detail-row">
                <span>Balance Due</span>
                <strong>{formatCurrency(selectedOrder.balanceDue)}</strong>
              </div>

              <div className="form-group">
                <label htmlFor="new-order-status">New Status</label>
                <select
                  id="new-order-status"
                  value={newOrderStatus}
                  onChange={(event) =>
                    setNewOrderStatus(event.target.value as OrderStatus)
                  }
                >
                  {orderStatusUpdateOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="order-status-note">Status Note</label>
                <textarea
                  id="order-status-note"
                  rows={4}
                  placeholder="Example: Customer confirmed delivery schedule."
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                />
              </div>

              {newOrderStatus === "delivered" && (
                <div className="warning-box">
                  Marking this order as Delivered will set the balance due to
                  $0.00 in this mock UI.
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="secondary-button" onClick={closeStatusModal}>
                Cancel
              </button>

              <button className="primary-button" onClick={handleSaveOrderStatus}>
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}

      {detailOrder && (
        <div className="modal-backdrop">
          <div className="modal-card order-detail-modal-card">
            <div className="modal-header">
              <div>
                <h3>Order Details</h3>
                <p>
                  {detailOrder.orderNumber} · {detailOrder.customerName}
                </p>
              </div>

              <button className="icon-button" onClick={closeDetailModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="order-detail-grid">
                <div className="detail-box">
                  <span>Customer</span>
                  <strong>{detailOrder.customerName}</strong>
                </div>

                <div className="detail-box">
                  <span>Phone</span>
                  <strong>{detailOrder.customerPhone}</strong>
                </div>

                <div className="detail-box">
                  <span>Status</span>
                  <strong>{orderStatusLabels[detailOrder.status]}</strong>
                </div>

                <div className="detail-box">
                  <span>Scheduled Delivery</span>
                  <strong>{detailOrder.scheduledDeliveryDate ?? "-"}</strong>
                </div>

                <div className="detail-box">
                  <span>Total Amount</span>
                  <strong>{formatCurrency(detailOrder.totalAmount)}</strong>
                </div>

                <div className="detail-box">
                  <span>Deposit</span>
                  <strong>{formatCurrency(detailOrder.depositAmount)}</strong>
                </div>

                <div className="detail-box">
                  <span>Balance Due</span>
                  <strong>{formatCurrency(detailOrder.balanceDue)}</strong>
                </div>

                <div className="detail-box">
                  <span>Created At</span>
                  <strong>{detailOrder.createdAt}</strong>
                </div>
              </div>

              {detailOrder.notes && (
                <div className="order-note-box">
                  <span>Notes</span>
                  <p>{detailOrder.notes}</p>
                </div>
              )}

              <div className="section-header">
                <h4>Order Items</h4>
                <p>{detailOrderItems.length} item(s) in this order.</p>
              </div>

              <table className="data-table compact-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Final Price</th>
                    <th>Inventory Item</th>
                  </tr>
                </thead>

                <tbody>
                  {detailOrderItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.sku}</td>
                      <td>{item.productName}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.unitPrice)}</td>
                      <td>{formatCurrency(item.finalPrice)}</td>
                      <td>{item.inventoryItemId ?? "-"}</td>
                    </tr>
                  ))}

                  {detailOrderItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-table-message">
                        No items found for this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <button className="secondary-button" onClick={closeDetailModal}>
                Close
              </button>

              <button
                className="primary-button"
                onClick={() => {
                  closeDetailModal();
                  openStatusModal(detailOrder);
                }}
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrdersPage;