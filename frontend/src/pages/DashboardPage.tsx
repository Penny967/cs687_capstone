import { mockInventory } from "../data/mockInventory";
import { mockOrders } from "../data/mockOrders";
import { mockSalesAnalyticsRecords } from "../data/mockSalesAnalytics";

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

  const analyticsRevenue = mockSalesAnalyticsRecords.reduce(
    (sum, record) => sum + record.price,
    0
  );

  const analyticsCost = mockSalesAnalyticsRecords.reduce(
    (sum, record) => sum + record.cost * record.sales,
    0
  );

  const grossProfit = analyticsRevenue - analyticsCost;

  const totalBalanceDue = mockOrders.reduce(
    (sum, order) => sum + order.balanceDue,
    0
  );

  const deliveryDayRecords = mockSalesAnalyticsRecords.filter(
    (record) => record.deliveryDays !== null
  );

  const averageDeliveryDays =
    deliveryDayRecords.length > 0
      ? deliveryDayRecords.reduce(
          (sum, record) => sum + (record.deliveryDays ?? 0),
          0
        ) / deliveryDayRecords.length
      : 0;

  const lowInventoryRecords = mockSalesAnalyticsRecords.filter(
    (record) => record.inventory <= 1
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>
            Overview of inventory status, customer orders, replenishment needs,
            and analytics-based profit performance.
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
          <span className="summary-label">Analytics Revenue</span>
          <strong>{formatCurrency(analyticsRevenue)}</strong>
          <p className="summary-helper">Generated from delivered orders</p>
        </div>

        <div className="summary-card">
          <span className="summary-label">Gross Profit</span>
          <strong>{formatCurrency(grossProfit)}</strong>
          <p className="summary-helper">Revenue minus tracked cost</p>
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
              <span>Delivered Orders</span>
              <strong>{deliveredOrders.length}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3>Analytics Snapshot</h3>
              <p>Summary generated from sales analytics records.</p>
            </div>
          </div>

          <div className="status-list">
            <div className="status-list-item">
              <span>Analytics Records</span>
              <strong>{mockSalesAnalyticsRecords.length}</strong>
            </div>

            <div className="status-list-item">
              <span>Average Delivery Days</span>
              <strong>{averageDeliveryDays.toFixed(1)}</strong>
            </div>

            <div className="status-list-item">
              <span>Balance Due</span>
              <strong>{formatCurrency(totalBalanceDue)}</strong>
            </div>

            <div className="status-list-item">
              <span>Low Inventory Alerts</span>
              <strong>{lowInventoryRecords.length}</strong>
            </div>
          </div>
        </div>

        <div className="card dashboard-wide-card">
          <div className="card-header">
            <div>
              <h3>Replenishment Alerts</h3>
              <p>Products that may need reorder review based on analytics data.</p>
            </div>

            <span className="badge badge-orange">
              {lowInventoryRecords.length} Alerts
            </span>
          </div>

          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Inventory</th>
                <th>Sales</th>
                <th>Season</th>
                <th>Suggested Action</th>
              </tr>
            </thead>

            <tbody>
              {lowInventoryRecords.map((record) => (
                <tr key={record.id}>
                  <td>{record.sku}</td>
                  <td>{record.inventory}</td>
                  <td>{record.sales}</td>
                  <td>{record.season}</td>
                  <td>Review reorder quantity.</td>
                </tr>
              ))}

              {lowInventoryRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-table-message">
                    No low inventory alerts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card dashboard-wide-card">
          <div className="card-header">
            <div>
              <h3>Recent Analytics Records</h3>
              <p>Latest generated records from delivered orders.</p>
            </div>
          </div>

          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>SKU</th>
                <th>Price</th>
                <th>Cost</th>
                <th>Sales</th>
                <th>Inventory</th>
                <th>Delivery Days</th>
                <th>Season</th>
              </tr>
            </thead>

            <tbody>
              {mockSalesAnalyticsRecords.map((record) => (
                <tr key={record.id}>
                  <td>{record.orderNumber}</td>
                  <td>{record.sku}</td>
                  <td>{formatCurrency(record.price)}</td>
                  <td>{formatCurrency(record.cost)}</td>
                  <td>{record.sales}</td>
                  <td>{record.inventory}</td>
                  <td>{record.deliveryDays ?? "-"}</td>
                  <td>{record.season}</td>
                </tr>
              ))}

              {mockSalesAnalyticsRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-table-message">
                    No analytics records generated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;