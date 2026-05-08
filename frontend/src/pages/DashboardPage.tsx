import { mockInventory } from "../data/mockInventory";
import { mockOrders } from "../data/mockOrders";

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function DashboardPage() {
  const totalInventoryItems = mockInventory.length;

  const inTransitCount = mockInventory.filter(
    (item) => item.status === "in_transit"
  ).length;

  const warehouseCount = mockInventory.filter(
    (item) => item.status === "local_warehouse"
  ).length;

  const reservedCount = mockInventory.filter(
    (item) => item.status === "reserved"
  ).length;

  const activeOrders = mockOrders.filter(
    (order) =>
      order.status !== "delivered" &&
      order.status !== "cancelled" &&
      order.status !== "refunded"
  );

  const deliveredOrders = mockOrders.filter(
    (order) => order.status === "delivered"
  );

  const totalDeliveredRevenue = deliveredOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const totalBalanceDue = mockOrders.reduce(
    (sum, order) => sum + order.balanceDue,
    0
  );

  const damagedItems = mockInventory.filter(
    (item) => item.status === "damaged"
  );

  const lowStockSkuList = ["SOFA-001", "CHAIR-001"];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>
            Overview of inventory status, customer orders, replenishment needs,
            and profit performance.
          </p>
        </div>

        <button className="primary-button">Export Report</button>
      </div>

      <div className="dashboard-summary-grid">
        <div className="summary-card">
          <span className="summary-label">Total Inventory Items</span>
          <strong>{totalInventoryItems}</strong>
          <p className="summary-helper">All tracked furniture items</p>
        </div>

        <div className="summary-card">
          <span className="summary-label">Active Orders</span>
          <strong>{activeOrders.length}</strong>
          <p className="summary-helper">Orders not yet delivered</p>
        </div>

        <div className="summary-card">
          <span className="summary-label">Delivered Revenue</span>
          <strong>{formatCurrency(totalDeliveredRevenue)}</strong>
          <p className="summary-helper">Revenue from delivered orders</p>
        </div>

        <div className="summary-card">
          <span className="summary-label">Balance Due</span>
          <strong>{formatCurrency(totalBalanceDue)}</strong>
          <p className="summary-helper">Outstanding customer balance</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Inventory Overview</h3>
              <p>Current inventory distribution by status.</p>
            </div>
          </div>

          <div className="status-list">
            <div className="status-list-item">
              <span>In Transit</span>
              <strong>{inTransitCount}</strong>
            </div>

            <div className="status-list-item">
              <span>Local Warehouse</span>
              <strong>{warehouseCount}</strong>
            </div>

            <div className="status-list-item">
              <span>Reserved</span>
              <strong>{reservedCount}</strong>
            </div>

            <div className="status-list-item">
              <span>Damaged</span>
              <strong>{damagedItems.length}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3>Order Pipeline</h3>
              <p>Customer orders grouped by current progress.</p>
            </div>
          </div>

          <div className="status-list">
            <div className="status-list-item">
              <span>Inquiry</span>
              <strong>
                {
                  mockOrders.filter((order) => order.status === "inquiry")
                    .length
                }
              </strong>
            </div>

            <div className="status-list-item">
              <span>Deposit Paid</span>
              <strong>
                {
                  mockOrders.filter(
                    (order) => order.status === "deposit_paid"
                  ).length
                }
              </strong>
            </div>

            <div className="status-list-item">
              <span>Preparing</span>
              <strong>
                {
                  mockOrders.filter((order) => order.status === "preparing")
                    .length
                }
              </strong>
            </div>

            <div className="status-list-item">
              <span>Scheduled Delivery</span>
              <strong>
                {
                  mockOrders.filter(
                    (order) => order.status === "scheduled_delivery"
                  ).length
                }
              </strong>
            </div>
          </div>
        </div>

        <div className="card dashboard-wide-card">
          <div className="card-header">
            <div>
              <h3>Replenishment Alerts</h3>
              <p>Products that may need reorder review.</p>
            </div>

            <span className="badge badge-orange">
              {lowStockSkuList.length} Alerts
            </span>
          </div>

          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Reason</th>
                <th>Suggested Action</th>
              </tr>
            </thead>

            <tbody>
              {lowStockSkuList.map((sku) => (
                <tr key={sku}>
                  <td>{sku}</td>
                  <td>Available stock is below target level.</td>
                  <td>Review reorder quantity.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card dashboard-wide-card">
          <div className="card-header">
            <div>
              <h3>Recent Activity</h3>
              <p>Latest mock activities across inventory and orders.</p>
            </div>
          </div>

          <div className="activity-list">
            <div className="activity-item">
              <span className="activity-dot" />
              <div>
                <strong>Inventory item moved to Reserved</strong>
                <p>CHAIR-001 was reserved for order ORD-1001.</p>
              </div>
            </div>

            <div className="activity-item">
              <span className="activity-dot" />
              <div>
                <strong>Order status updated</strong>
                <p>ORD-1003 moved to Scheduled Delivery.</p>
              </div>
            </div>

            <div className="activity-item">
              <span className="activity-dot" />
              <div>
                <strong>Warehouse item received</strong>
                <p>TABLE-001 arrived at Seattle Warehouse.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;