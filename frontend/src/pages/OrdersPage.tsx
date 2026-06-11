import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "../api/client";
import type {
  CustomerOrder,
  CustomerOrderDetail,
  CustomerOrderStatus,
  CustomerOrderStatusUpdateRequest,
} from "../types/order";

type OrderStatusFilter = "all" | CustomerOrderStatus;

type StatusUpdateFormState = {
  status: CustomerOrderStatus;
  note: string;
};

const orderStatusLabels: Record<CustomerOrderStatus, string> = {
  inquiry: "Inquiry",
  deposit_paid: "Deposit Paid",
  preparing: "Preparing",
  scheduled_delivery: "Scheduled Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const orderStatusClassNames: Record<CustomerOrderStatus, string> = {
  inquiry: "badge badge-blue",
  deposit_paid: "badge badge-purple",
  preparing: "badge badge-yellow",
  scheduled_delivery: "badge badge-orange",
  delivered: "badge badge-green",
  cancelled: "badge badge-gray",
  refunded: "badge badge-red",
};

const orderStatusOptions: Array<{
  value: CustomerOrderStatus;
  label: string;
}> = [
  { value: "inquiry", label: "Inquiry" },
  { value: "deposit_paid", label: "Deposit Paid" },
  { value: "preparing", label: "Preparing" },
  {
    value: "scheduled_delivery",
    label: "Scheduled Delivery",
  },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

const orderStatusFilterOptions: Array<{
  value: OrderStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All Statuses" },
  ...orderStatusOptions,
];

function formatCurrency(value: string | number | null): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsedDate);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
}

function OrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);

  const [selectedStatus, setSelectedStatus] =
    useState<OrderStatusFilter>("all");

  const [searchTerm, setSearchTerm] = useState("");

  const [detailOrder, setDetailOrder] =
    useState<CustomerOrderDetail | null>(null);

  const [statusOrder, setStatusOrder] =
    useState<CustomerOrder | null>(null);

  const [statusUpdateForm, setStatusUpdateForm] =
    useState<StatusUpdateFormState>({
      status: "inquiry",
      note: "",
    });

  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailErrorMessage, setDetailErrorMessage] =
    useState<string | null>(null);
  const [modalErrorMessage, setModalErrorMessage] =
    useState<string | null>(null);

  async function loadOrders() {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const data = await apiRequest<CustomerOrder[]>(
        "/api/orders?limit=200"
      );

      setOrders(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load customer orders."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        selectedStatus === "all" ||
        order.status === selectedStatus;

      const searchableValues = [
        order.order_number,
        order.customer_name,
        order.customer_phone ?? "",
        order.status,
      ];

      const matchesSearch =
        normalizedSearch === "" ||
        searchableValues.some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        );

      return matchesStatus && matchesSearch;
    });
  }, [orders, searchTerm, selectedStatus]);

  const orderSummary = useMemo(() => {
    const activeStatuses: CustomerOrderStatus[] = [
      "inquiry",
      "deposit_paid",
      "preparing",
      "scheduled_delivery",
    ];

    const activeOrders = orders.filter((order) =>
      activeStatuses.includes(order.status)
    ).length;

    const deliveredOrders = orders.filter(
      (order) => order.status === "delivered"
    ).length;

    const totalBalanceDue = orders.reduce(
      (sum, order) => sum + Number(order.balance_due),
      0
    );

    const deliveredRevenue = orders
      .filter((order) => order.status === "delivered")
      .reduce(
        (sum, order) => sum + Number(order.total_amount),
        0
      );

    return {
      total: orders.length,
      active: activeOrders,
      delivered: deliveredOrders,
      totalBalanceDue,
      deliveredRevenue,
    };
  }, [orders]);

  async function openDetailModal(order: CustomerOrder) {
    setDetailOrder(null);
    setDetailErrorMessage(null);
    setIsDetailLoading(true);

    try {
      const data = await apiRequest<CustomerOrderDetail>(
        `/api/orders/${order.id}`
      );

      setDetailOrder(data);
    } catch (error) {
      setDetailErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load order details."
      );
    } finally {
      setIsDetailLoading(false);
    }
  }

  function closeDetailModal() {
    setDetailOrder(null);
    setDetailErrorMessage(null);
    setIsDetailLoading(false);
  }

  function openStatusModal(order: CustomerOrder) {
    setStatusOrder(order);
    setModalErrorMessage(null);

    setStatusUpdateForm({
      status: order.status,
      note: "",
    });
  }

  function closeStatusModal() {
    if (isUpdatingStatus) {
      return;
    }

    setStatusOrder(null);
    setModalErrorMessage(null);

    setStatusUpdateForm({
      status: "inquiry",
      note: "",
    });
  }

  async function handleUpdateOrderStatus() {
    if (!statusOrder) {
      return;
    }

    setModalErrorMessage(null);

    if (
      statusOrder.status === "delivered" &&
      statusUpdateForm.status !== "delivered"
    ) {
      setModalErrorMessage(
        "A delivered order cannot be changed directly to another status."
      );
      return;
    }

    const payload: CustomerOrderStatusUpdateRequest = {
      status: statusUpdateForm.status,
      note: statusUpdateForm.note.trim() || null,
    };

    try {
      setIsUpdatingStatus(true);

      const updatedOrder = await apiRequest<CustomerOrderDetail>(
        `/api/orders/${statusOrder.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === updatedOrder.id
            ? {
                id: updatedOrder.id,
                order_number: updatedOrder.order_number,
                customer_name: updatedOrder.customer_name,
                customer_phone: updatedOrder.customer_phone,
                status: updatedOrder.status,
                total_amount: updatedOrder.total_amount,
                deposit_amount: updatedOrder.deposit_amount,
                balance_due: updatedOrder.balance_due,
                scheduled_delivery_date:
                  updatedOrder.scheduled_delivery_date,
                delivered_at: updatedOrder.delivered_at,
                notes: updatedOrder.notes,
                created_at: updatedOrder.created_at,
                updated_at: updatedOrder.updated_at,
              }
            : order
        )
      );

      if (detailOrder?.id === updatedOrder.id) {
        setDetailOrder(updatedOrder);
      }

      closeStatusModal();
    } catch (error) {
      setModalErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update order status."
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  function openStatusFromDetail() {
    if (!detailOrder) {
      return;
    }

    const orderForStatus: CustomerOrder = {
      id: detailOrder.id,
      order_number: detailOrder.order_number,
      customer_name: detailOrder.customer_name,
      customer_phone: detailOrder.customer_phone,
      status: detailOrder.status,
      total_amount: detailOrder.total_amount,
      deposit_amount: detailOrder.deposit_amount,
      balance_due: detailOrder.balance_due,
      scheduled_delivery_date:
        detailOrder.scheduled_delivery_date,
      delivered_at: detailOrder.delivered_at,
      notes: detailOrder.notes,
      created_at: detailOrder.created_at,
      updated_at: detailOrder.updated_at,
    };

    closeDetailModal();
    openStatusModal(orderForStatus);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Customer Orders</h2>
          <p>
            Track customer orders from inquiry through final delivery.
            Delivered orders automatically generate analytics records
            and update linked inventory.
          </p>
        </div>

        <button
          className="primary-button"
          type="button"
          disabled
          title="The create order API will be added later."
        >
          Add Order
        </button>
      </div>

      <div className="inventory-summary-grid">
        <div className="summary-card">
          <span className="summary-label">Total Orders</span>
          <strong>{orderSummary.total}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Active Orders</span>
          <strong>{orderSummary.active}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Delivered Orders</span>
          <strong>{orderSummary.delivered}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Balance Due</span>
          <strong>
            {formatCurrency(orderSummary.totalBalanceDue)}
          </strong>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div>
            <h3>Order List</h3>
            <p>
              Showing {filteredOrders.length} of {orders.length} orders.
              Delivered revenue:{" "}
              {formatCurrency(orderSummary.deliveredRevenue)}.
            </p>
          </div>

          <div className="table-actions">
            <div className="search-group">
              <label htmlFor="order-search">Search</label>

              <input
                id="order-search"
                type="search"
                placeholder="Search order, customer, phone..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />
            </div>

            <div className="filter-group">
              <label htmlFor="order-status-filter">
                Status
              </label>

              <select
                id="order-status-filter"
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(
                    event.target.value as OrderStatusFilter
                  )
                }
              >
                {orderStatusFilterOptions.map((option) => (
                  <option
                    value={option.value}
                    key={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="page-state-message">
            Loading customer orders from the database...
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="error-message" role="alert">
            <strong>Unable to load customer orders.</strong>
            <span>{errorMessage}</span>

            <button
              className="secondary-button"
              type="button"
              onClick={() => void loadOrders()}
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !errorMessage && (
          <div className="table-scroll-container">
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
                    <td>{order.order_number}</td>
                    <td>{order.customer_name}</td>
                    <td>{order.customer_phone ?? "-"}</td>

                    <td>
                      <span
                        className={
                          orderStatusClassNames[order.status]
                        }
                      >
                        {orderStatusLabels[order.status]}
                      </span>
                    </td>

                    <td>
                      {formatCurrency(order.total_amount)}
                    </td>

                    <td>
                      {formatCurrency(order.deposit_amount)}
                    </td>

                    <td>
                      {formatCurrency(order.balance_due)}
                    </td>

                    <td>
                      {formatDate(
                        order.scheduled_delivery_date
                      )}
                    </td>

                    <td>{formatDateTime(order.created_at)}</td>

                    <td>
                      <div className="row-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() =>
                            void openDetailModal(order)
                          }
                        >
                          View Details
                        </button>

                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() =>
                            openStatusModal(order)
                          }
                        >
                          Update Status
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredOrders.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="empty-table-message"
                    >
                      No customer orders match the current
                      filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(isDetailLoading ||
        detailErrorMessage ||
        detailOrder) && (
        <div className="modal-backdrop">
          <div className="modal-card order-detail-modal-card">
            <div className="modal-header">
              <div>
                <h3>Order Details</h3>

                <p>
                  {detailOrder
                    ? `${detailOrder.order_number} · ${detailOrder.customer_name}`
                    : "Loading order information"}
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={closeDetailModal}
                aria-label="Close order detail modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {isDetailLoading && (
                <div className="page-state-message">
                  Loading order details...
                </div>
              )}

              {!isDetailLoading && detailErrorMessage && (
                <div className="error-message" role="alert">
                  <strong>
                    Unable to load order details.
                  </strong>
                  <span>{detailErrorMessage}</span>
                </div>
              )}

              {!isDetailLoading &&
                !detailErrorMessage &&
                detailOrder && (
                  <>
                    <div className="order-detail-grid">
                      <div className="detail-box">
                        <span>Order Number</span>
                        <strong>
                          {detailOrder.order_number}
                        </strong>
                      </div>

                      <div className="detail-box">
                        <span>Customer</span>
                        <strong>
                          {detailOrder.customer_name}
                        </strong>
                      </div>

                      <div className="detail-box">
                        <span>Phone</span>
                        <strong>
                          {detailOrder.customer_phone ?? "-"}
                        </strong>
                      </div>

                      <div className="detail-box">
                        <span>Status</span>

                        <strong>
                          <span
                            className={
                              orderStatusClassNames[
                                detailOrder.status
                              ]
                            }
                          >
                            {
                              orderStatusLabels[
                                detailOrder.status
                              ]
                            }
                          </span>
                        </strong>
                      </div>

                      <div className="detail-box">
                        <span>Total Amount</span>
                        <strong>
                          {formatCurrency(
                            detailOrder.total_amount
                          )}
                        </strong>
                      </div>

                      <div className="detail-box">
                        <span>Deposit Amount</span>
                        <strong>
                          {formatCurrency(
                            detailOrder.deposit_amount
                          )}
                        </strong>
                      </div>

                      <div className="detail-box">
                        <span>Balance Due</span>
                        <strong>
                          {formatCurrency(
                            detailOrder.balance_due
                          )}
                        </strong>
                      </div>

                      <div className="detail-box">
                        <span>Scheduled Delivery</span>
                        <strong>
                          {formatDate(
                            detailOrder.scheduled_delivery_date
                          )}
                        </strong>
                      </div>

                      <div className="detail-box">
                        <span>Delivered At</span>
                        <strong>
                          {formatDateTime(
                            detailOrder.delivered_at
                          )}
                        </strong>
                      </div>

                      <div className="detail-box">
                        <span>Created At</span>
                        <strong>
                          {formatDateTime(
                            detailOrder.created_at
                          )}
                        </strong>
                      </div>
                    </div>

                    {detailOrder.notes && (
                      <div className="order-note-box">
                        <span>Notes</span>
                        <p>{detailOrder.notes}</p>
                      </div>
                    )}

                    <div className="section-header">
                      <div>
                        <h4>Order Items</h4>
                        <p>
                          {detailOrder.items.length} item record(s)
                          in this order.
                        </p>
                      </div>
                    </div>

                    <div className="table-scroll-container">
                      <table className="data-table compact-table">
                        <thead>
                          <tr>
                            <th>SKU</th>
                            <th>Product Name</th>
                            <th>Quantity</th>
                            <th>Unit Price</th>
                            <th>Discount</th>
                            <th>Final Price</th>
                            <th>Inventory Item</th>
                          </tr>
                        </thead>

                        <tbody>
                          {detailOrder.items.map((item) => (
                            <tr key={item.id}>
                              <td>{item.sku}</td>
                              <td>{item.product_name}</td>
                              <td>{item.quantity}</td>
                              <td>
                                {formatCurrency(
                                  item.unit_price
                                )}
                              </td>
                              <td>
                                {formatCurrency(
                                  item.discount_amount
                                )}
                              </td>
                              <td>
                                {formatCurrency(
                                  item.final_price
                                )}
                              </td>
                              <td>
                                {item.inventory_item_id ?? "-"}
                              </td>
                            </tr>
                          ))}

                          {detailOrder.items.length === 0 && (
                            <tr>
                              <td
                                colSpan={7}
                                className="empty-table-message"
                              >
                                No items were found for this
                                order.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                onClick={closeDetailModal}
              >
                Close
              </button>

              {detailOrder && (
                <button
                  className="primary-button"
                  type="button"
                  onClick={openStatusFromDetail}
                >
                  Update Status
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {statusOrder && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Update Order Status</h3>
                <p>
                  {statusOrder.order_number} ·{" "}
                  {statusOrder.customer_name}
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={closeStatusModal}
                aria-label="Close order status modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {modalErrorMessage && (
                <div className="error-message" role="alert">
                  <strong>
                    Unable to update order status.
                  </strong>
                  <span>{modalErrorMessage}</span>
                </div>
              )}

              <div className="detail-row">
                <span>Current Status</span>
                <strong>
                  {orderStatusLabels[statusOrder.status]}
                </strong>
              </div>

              <div className="detail-row">
                <span>Current Balance Due</span>
                <strong>
                  {formatCurrency(statusOrder.balance_due)}
                </strong>
              </div>

              <div className="form-group">
                <label htmlFor="new-order-status">
                  New Status
                </label>

                <select
                  id="new-order-status"
                  value={statusUpdateForm.status}
                  disabled={statusOrder.status === "delivered"}
                  onChange={(event) =>
                    setStatusUpdateForm((current) => ({
                      ...current,
                      status: event.target
                        .value as CustomerOrderStatus,
                    }))
                  }
                >
                  {orderStatusOptions.map((option) => (
                    <option
                      value={option.value}
                      key={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="order-status-note">
                  Status Note
                </label>

                <textarea
                  id="order-status-note"
                  rows={4}
                  placeholder="Example: Customer confirmed the delivery."
                  value={statusUpdateForm.note}
                  onChange={(event) =>
                    setStatusUpdateForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </div>

              {statusUpdateForm.status === "delivered" &&
                statusOrder.status !== "delivered" && (
                  <div className="warning-box">
                    Marking this order as Delivered will:
                    <br />
                    set the balance due to $0.00,
                    <br />
                    mark linked inventory as Sold,
                    <br />
                    create inventory movement records,
                    <br />
                    and generate sales analytics records.
                  </div>
                )}

              {statusOrder.status === "delivered" && (
                <div className="warning-box">
                  This order has already been delivered. Its
                  inventory and analytics records have already been
                  generated. A delivered order cannot be changed
                  directly to another status.
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                disabled={isUpdatingStatus}
                onClick={closeStatusModal}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                type="button"
                disabled={
                  isUpdatingStatus ||
                  statusOrder.status === "delivered"
                }
                onClick={() =>
                  void handleUpdateOrderStatus()
                }
              >
                {isUpdatingStatus
                  ? "Saving..."
                  : "Save Status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrdersPage;