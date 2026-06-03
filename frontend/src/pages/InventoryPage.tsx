import { useState } from "react";

import { mockInventory } from "../data/mockInventory";
import { mockInventoryMovements } from "../data/mockInventoryMovements";
import type {
  InventoryCondition,
  InventoryItem,
  InventoryMovement,
  InventoryStatus,
  StoreType,
} from "../types/inventory";

type InventoryStatusFilter = "all" | InventoryStatus;

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

const statusFilterOptions: { value: InventoryStatusFilter; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "in_production", label: "In Production" },
  { value: "in_transit", label: "In Transit" },
  { value: "local_warehouse", label: "Local Warehouse" },
  { value: "showroom", label: "Showroom" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "damaged", label: "Damaged" },
  { value: "returned", label: "Returned" },
];

const statusUpdateOptions: { value: InventoryStatus; label: string }[] = [
  { value: "in_production", label: "In Production" },
  { value: "in_transit", label: "In Transit" },
  { value: "local_warehouse", label: "Local Warehouse" },
  { value: "showroom", label: "Showroom" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "damaged", label: "Damaged" },
  { value: "returned", label: "Returned" },
];

const conditionOptions: { value: InventoryCondition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "display", label: "Display" },
  { value: "open_box", label: "Open Box" },
  { value: "damaged", label: "Damaged" },
  { value: "returned", label: "Returned" },
];

const storeTypeOptions: { value: StoreType; label: string }[] = [
  { value: "factory", label: "Factory" },
  { value: "warehouse", label: "Warehouse" },
  { value: "showroom", label: "Showroom" },
  { value: "in_transit", label: "In Transit" },
  { value: "online", label: "Online" },
  { value: "other", label: "Other" },
];

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function InventoryPage() {
  const [inventoryItems, setInventoryItems] =
    useState<InventoryItem[]>(mockInventory);

  const [inventoryMovements, setInventoryMovements] =
    useState<InventoryMovement[]>(mockInventoryMovements);

  const [selectedStatus, setSelectedStatus] =
    useState<InventoryStatusFilter>("all");

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [timelineItem, setTimelineItem] = useState<InventoryItem | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [newStatus, setNewStatus] =
    useState<InventoryStatus>("local_warehouse");

  const [movementNote, setMovementNote] = useState("");

  const [newInventoryItem, setNewInventoryItem] = useState({
    productId: "",
    sku: "",
    productName: "",

    category: "",
    material: "",
    color: "",

    price: "",
    cost: "",

    status: "local_warehouse" as InventoryStatus,
    location: "",
    storeType: "warehouse" as StoreType,

    condition: "new" as InventoryCondition,
    batchNumber: "",

    receivedDate: "",
    estimatedArrivalDate: "",
    actualArrivalDate: "",

    reservedOrderNumber: "",
    notes: "",
  });

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredInventory = inventoryItems.filter((item) => {
    const matchesStatus =
      selectedStatus === "all" || item.status === selectedStatus;

    const matchesSearch =
      normalizedSearchTerm === "" ||
      item.sku.toLowerCase().includes(normalizedSearchTerm) ||
      item.productName.toLowerCase().includes(normalizedSearchTerm) ||
      item.category.toLowerCase().includes(normalizedSearchTerm) ||
      item.material.toLowerCase().includes(normalizedSearchTerm) ||
      item.color.toLowerCase().includes(normalizedSearchTerm) ||
      item.location.toLowerCase().includes(normalizedSearchTerm) ||
      item.storeType.toLowerCase().includes(normalizedSearchTerm) ||
      item.batchNumber.toLowerCase().includes(normalizedSearchTerm) ||
      item.reservedOrderNumber?.toLowerCase().includes(normalizedSearchTerm);

    return matchesStatus && matchesSearch;
  });

  const selectedTimelineMovements = timelineItem
    ? inventoryMovements.filter(
        (movement) => movement.inventoryItemId === timelineItem.id
      )
    : [];

  function openStatusModal(item: InventoryItem) {
    setSelectedItem(item);
    setNewStatus(item.status);
    setMovementNote("");
  }

  function closeStatusModal() {
    setSelectedItem(null);
    setMovementNote("");
  }

  function openTimelineModal(item: InventoryItem) {
    setTimelineItem(item);
  }

  function closeTimelineModal() {
    setTimelineItem(null);
  }

  function openAddModal() {
    setIsAddModalOpen(true);
  }

  function closeAddModal() {
    setIsAddModalOpen(false);
    resetNewInventoryItem();
  }

  function resetNewInventoryItem() {
    setNewInventoryItem({
      productId: "",
      sku: "",
      productName: "",

      category: "",
      material: "",
      color: "",

      price: "",
      cost: "",

      status: "local_warehouse",
      location: "",
      storeType: "warehouse",

      condition: "new",
      batchNumber: "",

      receivedDate: "",
      estimatedArrivalDate: "",
      actualArrivalDate: "",

      reservedOrderNumber: "",
      notes: "",
    });
  }

  function handleSaveStatusUpdate() {
    if (!selectedItem) {
      return;
    }

    const oldStatus = selectedItem.status;

    const updatedMovement: InventoryMovement = {
      id: `move-${Date.now()}`,
      inventoryItemId: selectedItem.id,
      fromStatus: oldStatus,
      toStatus: newStatus,
      fromLocation: selectedItem.location,
      toLocation: selectedItem.location,
      movementReason:
        movementNote.trim() || `Status changed to ${statusLabels[newStatus]}.`,
      performedBy: "Current User",
      createdAt: new Date().toLocaleString(),
    };

    setInventoryItems((currentItems) =>
      currentItems.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              status: newStatus,
              notes: movementNote.trim() || item.notes,
            }
          : item
      )
    );

    setInventoryMovements((currentMovements) => [
      ...currentMovements,
      updatedMovement,
    ]);

    closeStatusModal();
  }

  function handleSaveNewInventoryItem() {
    const trimmedSku = newInventoryItem.sku.trim();
    const trimmedProductName = newInventoryItem.productName.trim();
    const trimmedCategory = newInventoryItem.category.trim();
    const trimmedMaterial = newInventoryItem.material.trim();
    const trimmedColor = newInventoryItem.color.trim();
    const trimmedLocation = newInventoryItem.location.trim();
    const trimmedBatchNumber = newInventoryItem.batchNumber.trim();

    const parsedPrice = Number(newInventoryItem.price);
    const parsedCost = Number(newInventoryItem.cost);

    if (
      !trimmedSku ||
      !trimmedProductName ||
      !trimmedCategory ||
      !trimmedMaterial ||
      !trimmedColor ||
      !trimmedLocation ||
      !trimmedBatchNumber
    ) {
      alert(
        "Please fill in SKU, Product Name, Category, Material, Color, Location, and Batch Number."
      );
      return;
    }

    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      alert("Please enter a valid price.");
      return;
    }

    if (Number.isNaN(parsedCost) || parsedCost < 0) {
      alert("Please enter a valid cost.");
      return;
    }

    const itemId = `inv-${Date.now()}`;

    const itemToAdd: InventoryItem = {
      id: itemId,
      productId: newInventoryItem.productId.trim() || `product-${Date.now()}`,
      sku: trimmedSku,
      productName: trimmedProductName,

      category: trimmedCategory,
      material: trimmedMaterial,
      color: trimmedColor,

      price: parsedPrice,
      cost: parsedCost,

      status: newInventoryItem.status,
      location: trimmedLocation,
      storeType: newInventoryItem.storeType,

      condition: newInventoryItem.condition,
      batchNumber: trimmedBatchNumber,

      receivedDate: newInventoryItem.receivedDate.trim() || undefined,
      estimatedArrivalDate:
        newInventoryItem.estimatedArrivalDate.trim() || undefined,
      actualArrivalDate: newInventoryItem.actualArrivalDate.trim() || undefined,

      reservedOrderNumber:
        newInventoryItem.reservedOrderNumber.trim() || undefined,
      notes: newInventoryItem.notes.trim() || undefined,
    };

    const initialMovement: InventoryMovement = {
      id: `move-${Date.now()}`,
      inventoryItemId: itemId,
      toStatus: newInventoryItem.status,
      toLocation: trimmedLocation,
      movementReason:
        newInventoryItem.notes.trim() ||
        `Inventory item created with status ${
          statusLabels[newInventoryItem.status]
        }.`,
      performedBy: "Current User",
      createdAt: new Date().toLocaleString(),
    };

    setInventoryItems((currentItems) => [...currentItems, itemToAdd]);

    setInventoryMovements((currentMovements) => [
      ...currentMovements,
      initialMovement,
    ]);

    closeAddModal();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Inventory</h2>
          <p>
            Track furniture items across product attributes, inventory status,
            location, cost, price, and store type.
          </p>
        </div>

        <button className="primary-button" onClick={openAddModal}>
          Add Inventory Item
        </button>
      </div>

      <div className="inventory-summary-grid">
        <div className="summary-card">
          <span className="summary-label">Total Items</span>
          <strong>{inventoryItems.length}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">In Transit</span>
          <strong>
            {
              inventoryItems.filter((item) => item.status === "in_transit")
                .length
            }
          </strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Local Warehouse</span>
          <strong>
            {
              inventoryItems.filter(
                (item) => item.status === "local_warehouse"
              ).length
            }
          </strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Reserved</span>
          <strong>
            {
              inventoryItems.filter((item) => item.status === "reserved")
                .length
            }
          </strong>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div>
            <h3>Inventory Items</h3>
            <p>
              Showing {filteredInventory.length} of {inventoryItems.length}{" "}
              items.
            </p>
          </div>

          <div className="table-actions">
            <div className="search-group">
              <label htmlFor="inventory-search">Search</label>
              <input
                id="inventory-search"
                type="text"
                placeholder="Search SKU, product, category, location..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="status-filter">Status</label>
              <select
                id="status-filter"
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(event.target.value as InventoryStatusFilter)
                }
              >
                {statusFilterOptions.map((option) => (
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
              <th>SKU</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Status</th>
              <th>Location</th>
              <th>Store Type</th>
              <th>Cost</th>
              <th>Price</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredInventory.map((item) => (
              <tr key={item.id}>
                <td>{item.sku}</td>
                <td>{item.productName}</td>
                <td>{item.category}</td>
                <td>
                  <span className={statusClassNames[item.status]}>
                    {statusLabels[item.status]}
                  </span>
                </td>
                <td>{item.location}</td>
                <td>{item.storeType}</td>
                <td>{formatCurrency(item.cost)}</td>
                <td>{formatCurrency(item.price)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="secondary-button"
                      onClick={() => openStatusModal(item)}
                    >
                      Move Status
                    </button>

                    <button
                      className="secondary-button"
                      onClick={() => openTimelineModal(item)}
                    >
                      View Timeline
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredInventory.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-table-message">
                  No inventory items match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedItem && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Update Inventory Status</h3>
                <p>
                  {selectedItem.sku} · {selectedItem.productName}
                </p>
              </div>

              <button className="icon-button" onClick={closeStatusModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-row">
                <span>Current Status</span>
                <strong>{statusLabels[selectedItem.status]}</strong>
              </div>

              <div className="detail-row">
                <span>Current Location</span>
                <strong>{selectedItem.location}</strong>
              </div>

              <div className="form-group">
                <label htmlFor="new-status">New Status</label>
                <select
                  id="new-status"
                  value={newStatus}
                  onChange={(event) =>
                    setNewStatus(event.target.value as InventoryStatus)
                  }
                >
                  {statusUpdateOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="movement-note">Movement Note</label>
                <textarea
                  id="movement-note"
                  rows={4}
                  placeholder="Example: Arrived at Seattle warehouse."
                  value={movementNote}
                  onChange={(event) => setMovementNote(event.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="secondary-button" onClick={closeStatusModal}>
                Cancel
              </button>

              <button
                className="primary-button"
                onClick={handleSaveStatusUpdate}
              >
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}

      {timelineItem && (
        <div className="modal-backdrop">
          <div className="modal-card timeline-modal-card">
            <div className="modal-header">
              <div>
                <h3>Inventory Movement Timeline</h3>
                <p>
                  {timelineItem.sku} · {timelineItem.productName}
                </p>
              </div>

              <button className="icon-button" onClick={closeTimelineModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="order-detail-grid">
                <div className="detail-box">
                  <span>Category</span>
                  <strong>{timelineItem.category}</strong>
                </div>

                <div className="detail-box">
                  <span>Material</span>
                  <strong>{timelineItem.material}</strong>
                </div>

                <div className="detail-box">
                  <span>Color</span>
                  <strong>{timelineItem.color}</strong>
                </div>

                <div className="detail-box">
                  <span>Store Type</span>
                  <strong>{timelineItem.storeType}</strong>
                </div>

                <div className="detail-box">
                  <span>Cost</span>
                  <strong>{formatCurrency(timelineItem.cost)}</strong>
                </div>

                <div className="detail-box">
                  <span>Price</span>
                  <strong>{formatCurrency(timelineItem.price)}</strong>
                </div>

                <div className="detail-box">
                  <span>Batch</span>
                  <strong>{timelineItem.batchNumber}</strong>
                </div>

                <div className="detail-box">
                  <span>ETA</span>
                  <strong>{timelineItem.estimatedArrivalDate ?? "-"}</strong>
                </div>
              </div>

              {selectedTimelineMovements.length > 0 ? (
                <div className="timeline">
                  {selectedTimelineMovements.map((movement) => (
                    <div className="timeline-item" key={movement.id}>
                      <div className="timeline-marker" />

                      <div className="timeline-content">
                        <div className="timeline-topline">
                          <span className={statusClassNames[movement.toStatus]}>
                            {statusLabels[movement.toStatus]}
                          </span>

                          <span className="timeline-date">
                            {movement.createdAt}
                          </span>
                        </div>

                        <p className="timeline-reason">
                          {movement.movementReason}
                        </p>

                        <div className="timeline-meta">
                          <span>
                            From:{" "}
                            {movement.fromStatus
                              ? statusLabels[movement.fromStatus]
                              : "New Record"}
                          </span>
                          <span>To: {statusLabels[movement.toStatus]}</span>
                          <span>Location: {movement.toLocation}</span>
                          <span>By: {movement.performedBy}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-table-message">
                  No movement history found for this inventory item.
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button className="secondary-button" onClick={closeTimelineModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card add-inventory-modal-card">
            <div className="modal-header">
              <div>
                <h3>Add Inventory Item</h3>
                <p>
                  Create a new furniture inventory record with product
                  attributes, cost, price, location, and store type.
                </p>
              </div>

              <button className="icon-button" onClick={closeAddModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="add-product-id">Product ID</label>
                  <input
                    id="add-product-id"
                    type="text"
                    placeholder="Example: p-001"
                    value={newInventoryItem.productId}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        productId: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="add-sku">SKU *</label>
                  <input
                    id="add-sku"
                    type="text"
                    placeholder="Example: SOFA-002"
                    value={newInventoryItem.sku}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        sku: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="add-product-name">Product Name *</label>
                  <input
                    id="add-product-name"
                    type="text"
                    placeholder="Example: Leather Sectional Sofa"
                    value={newInventoryItem.productName}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        productName: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="add-category">Category *</label>
                  <input
                    id="add-category"
                    type="text"
                    placeholder="Example: Sofa"
                    value={newInventoryItem.category}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="add-material">Material *</label>
                  <input
                    id="add-material"
                    type="text"
                    placeholder="Example: Fabric"
                    value={newInventoryItem.material}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        material: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="add-color">Color *</label>
                  <input
                    id="add-color"
                    type="text"
                    placeholder="Example: Gray"
                    value={newInventoryItem.color}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        color: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="add-cost">Cost *</label>
                  <input
                    id="add-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Example: 520"
                    value={newInventoryItem.cost}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        cost: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="add-price">Price *</label>
                  <input
                    id="add-price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Example: 1299"
                    value={newInventoryItem.price}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        price: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="add-status">Status</label>
                  <select
                    id="add-status"
                    value={newInventoryItem.status}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        status: event.target.value as InventoryStatus,
                      }))
                    }
                  >
                    {statusUpdateOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="add-condition">Condition</label>
                  <select
                    id="add-condition"
                    value={newInventoryItem.condition}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        condition: event.target.value as InventoryCondition,
                      }))
                    }
                  >
                    {conditionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="add-location">Location *</label>
                  <input
                    id="add-location"
                    type="text"
                    placeholder="Example: Seattle Warehouse"
                    value={newInventoryItem.location}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="add-store-type">Store Type</label>
                  <select
                    id="add-store-type"
                    value={newInventoryItem.storeType}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        storeType: event.target.value as StoreType,
                      }))
                    }
                  >
                    {storeTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="add-batch-number">Batch Number *</label>
                  <input
                    id="add-batch-number"
                    type="text"
                    placeholder="Example: BATCH-2026-004"
                    value={newInventoryItem.batchNumber}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        batchNumber: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="add-reserved-order">Reserved Order</label>
                  <input
                    id="add-reserved-order"
                    type="text"
                    placeholder="Example: ORD-1002"
                    value={newInventoryItem.reservedOrderNumber}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        reservedOrderNumber: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="add-received-date">Received Date</label>
                  <input
                    id="add-received-date"
                    type="date"
                    value={newInventoryItem.receivedDate}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        receivedDate: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="add-eta">Estimated Arrival Date</label>
                  <input
                    id="add-eta"
                    type="date"
                    value={newInventoryItem.estimatedArrivalDate}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        estimatedArrivalDate: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="add-actual-arrival-date">
                    Actual Arrival Date
                  </label>
                  <input
                    id="add-actual-arrival-date"
                    type="date"
                    value={newInventoryItem.actualArrivalDate}
                    onChange={(event) =>
                      setNewInventoryItem((current) => ({
                        ...current,
                        actualArrivalDate: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="add-notes">Notes</label>
                <textarea
                  id="add-notes"
                  rows={4}
                  placeholder="Optional notes for this inventory item."
                  value={newInventoryItem.notes}
                  onChange={(event) =>
                    setNewInventoryItem((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="secondary-button" onClick={closeAddModal}>
                Cancel
              </button>

              <button
                className="primary-button"
                onClick={handleSaveNewInventoryItem}
              >
                Save Inventory Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryPage;