import { mockInventory } from "../data/mockInventory";
import type { InventoryStatus } from "../types/inventory";

const statusLabels: Record<InventoryStatus, string> = {
  in_production: "In Production",
  in_transit: "In Transit",
  local_warehouse: "Local Warehouse",
  showroom: "Showroom",
  reserved: "Reserved",
  sold: "Sold",
  damaged: "Damaged",
  returned: "Returned",
};

const statusClassNames: Record<InventoryStatus, string> = {
  in_production: "badge badge-blue",
  in_transit: "badge badge-purple",
  local_warehouse: "badge badge-green",
  showroom: "badge badge-yellow",
  reserved: "badge badge-orange",
  sold: "badge badge-gray",
  damaged: "badge badge-red",
  returned: "badge badge-indigo",
};

function InventoryPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Inventory</h2>
          <p>Track furniture items across production, transit, warehouse, showroom, and reserved statuses.</p>
        </div>

        <button className="primary-button">Add Inventory Item</button>
      </div>

      <div className="inventory-summary-grid">
        <div className="summary-card">
          <span className="summary-label">Total Items</span>
          <strong>{mockInventory.length}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">In Transit</span>
          <strong>{mockInventory.filter((item) => item.status === "in_transit").length}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Local Warehouse</span>
          <strong>{mockInventory.filter((item) => item.status === "local_warehouse").length}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Reserved</span>
          <strong>{mockInventory.filter((item) => item.status === "reserved").length}</strong>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Status</th>
              <th>Location</th>
              <th>Condition</th>
              <th>Batch</th>
              <th>Reserved Order</th>
              <th>ETA</th>
            </tr>
          </thead>

          <tbody>
            {mockInventory.map((item) => (
              <tr key={item.id}>
                <td>{item.sku}</td>
                <td>{item.productName}</td>
                <td>
                  <span className={statusClassNames[item.status]}>
                    {statusLabels[item.status]}
                  </span>
                </td>
                <td>{item.location}</td>
                <td>{item.condition}</td>
                <td>{item.batchNumber}</td>
                <td>{item.reservedOrderNumber ?? "-"}</td>
                <td>{item.estimatedArrivalDate ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default InventoryPage;