import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "../api/client";
import type {
  InventoryItem,
  InventoryItemCreateRequest,
  InventoryMovement,
  InventoryStatus,
  InventoryStatusUpdateRequest,
} from "../types/inventory";
import type { Product } from "../types/product";

type InventoryStatusFilter = "all" | InventoryStatus;

type InventoryFormState = {
  productId: string;
  status: InventoryStatus;
  location: string;
  storeType: string;
  condition: string;
  batchNumber: string;
  unitCost: string;
  expectedSellingPrice: string;
  productionStartDate: string;
  estimatedArrivalDate: string;
  actualArrivalDate: string;
  receivedDate: string;
  notes: string;
};

type StatusUpdateFormState = {
  status: InventoryStatus;
  location: string;
  storeType: string;
  movementReason: string;
};

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

const statusOptions: Array<{
  value: InventoryStatus;
  label: string;
}> = [
  { value: "in_production", label: "In Production" },
  { value: "in_transit", label: "In Transit" },
  { value: "local_warehouse", label: "Local Warehouse" },
  { value: "showroom", label: "Showroom" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "damaged", label: "Damaged" },
  { value: "returned", label: "Returned" },
];

const statusFilterOptions: Array<{
  value: InventoryStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All Statuses" },
  ...statusOptions,
];

const storeTypeOptions = [
  { value: "factory", label: "Factory" },
  { value: "warehouse", label: "Warehouse" },
  { value: "showroom", label: "Showroom" },
  { value: "in_transit", label: "In Transit" },
  { value: "online", label: "Online" },
  { value: "other", label: "Other" },
];

const conditionOptions = [
  { value: "new", label: "New" },
  { value: "display", label: "Display" },
  { value: "open_box", label: "Open Box" },
  { value: "damaged", label: "Damaged" },
  { value: "returned", label: "Returned" },
];

const initialInventoryForm: InventoryFormState = {
  productId: "",
  status: "local_warehouse",
  location: "Seattle Warehouse",
  storeType: "warehouse",
  condition: "new",
  batchNumber: "",
  unitCost: "",
  expectedSellingPrice: "",
  productionStartDate: "",
  estimatedArrivalDate: "",
  actualArrivalDate: "",
  receivedDate: "",
  notes: "",
};

const initialStatusUpdateForm: StatusUpdateFormState = {
  status: "local_warehouse",
  location: "",
  storeType: "warehouse",
  movementReason: "",
};

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

function formatDateTime(value: string): string {
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

function formatText(value: string | null): string {
  if (!value) {
    return "-";
  }

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function emptyStringToNull(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function parseOptionalNumber(value: string): number | null {
  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getSuggestedLocation(status: InventoryStatus): {
  location: string;
  storeType: string;
} {
  switch (status) {
    case "in_production":
      return {
        location: "Foshan Factory",
        storeType: "factory",
      };

    case "in_transit":
      return {
        location: "Pacific Ocean Shipping",
        storeType: "in_transit",
      };

    case "local_warehouse":
      return {
        location: "Seattle Warehouse",
        storeType: "warehouse",
      };

    case "showroom":
    case "reserved":
      return {
        location: "Redmond Showroom",
        storeType: "showroom",
      };

    case "sold":
      return {
        location: "Customer Delivery",
        storeType: "other",
      };

    case "damaged":
    case "returned":
      return {
        location: "Seattle Warehouse",
        storeType: "warehouse",
      };

    default:
      return {
        location: "",
        storeType: "other",
      };
  }
}

function InventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [selectedStatus, setSelectedStatus] =
    useState<InventoryStatusFilter>("all");

  const [searchTerm, setSearchTerm] = useState("");

  const [timelineItem, setTimelineItem] =
    useState<InventoryItem | null>(null);

  const [timelineMovements, setTimelineMovements] = useState<
    InventoryMovement[]
  >([]);

  const [statusItem, setStatusItem] =
    useState<InventoryItem | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [inventoryForm, setInventoryForm] =
    useState<InventoryFormState>(initialInventoryForm);

  const [statusUpdateForm, setStatusUpdateForm] =
    useState<StatusUpdateFormState>(initialStatusUpdateForm);

  const [isLoading, setIsLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalErrorMessage, setModalErrorMessage] =
    useState<string | null>(null);
  const [timelineErrorMessage, setTimelineErrorMessage] =
    useState<string | null>(null);

  async function loadInventory() {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const data = await apiRequest<InventoryItem[]>(
        "/api/inventory/items?limit=500"
      );

      setInventoryItems(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load inventory."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadProducts() {
    if (products.length > 0) {
      return;
    }

    try {
      setIsProductsLoading(true);
      setModalErrorMessage(null);

      const data = await apiRequest<Product[]>(
        "/api/products?limit=200&is_active=true"
      );

      setProducts(data);
    } catch (error) {
      setModalErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load products."
      );
    } finally {
      setIsProductsLoading(false);
    }
  }

  useEffect(() => {
    void loadInventory();
  }, []);

  const selectedProduct = useMemo(() => {
    return (
      products.find(
        (product) => product.id === inventoryForm.productId
      ) ?? null
    );
  }, [inventoryForm.productId, products]);

  const filteredInventory = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return inventoryItems.filter((item) => {
      const matchesStatus =
        selectedStatus === "all" || item.status === selectedStatus;

      const searchableValues = [
        item.sku,
        item.product_name,
        item.category,
        item.material,
        item.color,
        item.location,
        item.store_type,
        item.condition,
        item.batch_number ?? "",
      ];

      const matchesSearch =
        normalizedSearchTerm === "" ||
        searchableValues.some((value) =>
          value.toLowerCase().includes(normalizedSearchTerm)
        );

      return matchesStatus && matchesSearch;
    });
  }, [inventoryItems, searchTerm, selectedStatus]);

  const inventorySummary = useMemo(() => {
    return {
      total: inventoryItems.length,
      inTransit: inventoryItems.filter(
        (item) => item.status === "in_transit"
      ).length,
      localWarehouse: inventoryItems.filter(
        (item) => item.status === "local_warehouse"
      ).length,
      reserved: inventoryItems.filter(
        (item) => item.status === "reserved"
      ).length,
    };
  }, [inventoryItems]);

  async function openAddModal() {
    setInventoryForm(initialInventoryForm);
    setModalErrorMessage(null);
    setIsAddModalOpen(true);

    await loadProducts();
  }

  function closeAddModal() {
    if (isCreating) {
      return;
    }

    setIsAddModalOpen(false);
    setInventoryForm(initialInventoryForm);
    setModalErrorMessage(null);
  }

  function handleProductSelection(productId: string) {
    const product =
      products.find((item) => item.id === productId) ?? null;

    setInventoryForm((current) => ({
      ...current,
      productId,
      unitCost: product?.default_cost ?? "",
      expectedSellingPrice: product?.default_price ?? "",
    }));
  }

  function handleInventoryStatusSelection(
    status: InventoryStatus
  ) {
    const suggestedValues = getSuggestedLocation(status);

    setInventoryForm((current) => ({
      ...current,
      status,
      location: suggestedValues.location,
      storeType: suggestedValues.storeType,
    }));
  }

  async function handleCreateInventoryItem() {
    setModalErrorMessage(null);

    if (!inventoryForm.productId) {
      setModalErrorMessage("Please select a product.");
      return;
    }

    if (!inventoryForm.location.trim()) {
      setModalErrorMessage("Location is required.");
      return;
    }

    const unitCost = parseOptionalNumber(inventoryForm.unitCost);
    const expectedSellingPrice = parseOptionalNumber(
      inventoryForm.expectedSellingPrice
    );

    if (
      inventoryForm.unitCost.trim() !== "" &&
      (unitCost === null || unitCost < 0)
    ) {
      setModalErrorMessage("Please enter a valid unit cost.");
      return;
    }

    if (
      inventoryForm.expectedSellingPrice.trim() !== "" &&
      (expectedSellingPrice === null || expectedSellingPrice < 0)
    ) {
      setModalErrorMessage(
        "Please enter a valid expected selling price."
      );
      return;
    }

    if (
      inventoryForm.productionStartDate &&
      inventoryForm.actualArrivalDate &&
      inventoryForm.actualArrivalDate <
        inventoryForm.productionStartDate
    ) {
      setModalErrorMessage(
        "Actual arrival date cannot be earlier than production start date."
      );
      return;
    }

    const payload: InventoryItemCreateRequest = {
      product_id: inventoryForm.productId,
      status: inventoryForm.status,
      location: inventoryForm.location.trim(),
      store_type: inventoryForm.storeType,
      condition: inventoryForm.condition,
      batch_number: emptyStringToNull(
        inventoryForm.batchNumber
      ),
      unit_cost: unitCost,
      expected_selling_price: expectedSellingPrice,
      production_start_date: emptyStringToNull(
        inventoryForm.productionStartDate
      ),
      estimated_arrival_date: emptyStringToNull(
        inventoryForm.estimatedArrivalDate
      ),
      actual_arrival_date: emptyStringToNull(
        inventoryForm.actualArrivalDate
      ),
      received_date: emptyStringToNull(
        inventoryForm.receivedDate
      ),
      notes: emptyStringToNull(inventoryForm.notes),
    };

    try {
      setIsCreating(true);

      const createdItem = await apiRequest<InventoryItem>(
        "/api/inventory/items",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setInventoryItems((currentItems) => [
        createdItem,
        ...currentItems,
      ]);

      closeAddModal();
    } catch (error) {
      setModalErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create inventory item."
      );
    } finally {
      setIsCreating(false);
    }
  }

  function openStatusModal(item: InventoryItem) {
    setStatusItem(item);
    setModalErrorMessage(null);

    setStatusUpdateForm({
      status: item.status,
      location: item.location,
      storeType: item.store_type,
      movementReason: "",
    });
  }

  function closeStatusModal() {
    if (isUpdatingStatus) {
      return;
    }

    setStatusItem(null);
    setModalErrorMessage(null);
    setStatusUpdateForm(initialStatusUpdateForm);
  }

  function handleStatusSelection(status: InventoryStatus) {
    const suggestedValues = getSuggestedLocation(status);

    setStatusUpdateForm((current) => ({
      ...current,
      status,
      location: suggestedValues.location,
      storeType: suggestedValues.storeType,
    }));
  }

  async function handleUpdateStatus() {
    if (!statusItem) {
      return;
    }

    setModalErrorMessage(null);

    if (!statusUpdateForm.location.trim()) {
      setModalErrorMessage("Location is required.");
      return;
    }

    const payload: InventoryStatusUpdateRequest = {
      status: statusUpdateForm.status,
      location: statusUpdateForm.location.trim(),
      store_type: statusUpdateForm.storeType,
      movement_reason:
        statusUpdateForm.movementReason.trim() ||
        `Status changed from ${statusLabels[statusItem.status]} to ${
          statusLabels[statusUpdateForm.status]
        }.`,
    };

    try {
      setIsUpdatingStatus(true);

      const updatedItem = await apiRequest<InventoryItem>(
        `/api/inventory/items/${statusItem.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );

      setInventoryItems((currentItems) =>
        currentItems.map((item) =>
          item.id === updatedItem.id ? updatedItem : item
        )
      );

      closeStatusModal();
    } catch (error) {
      setModalErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update inventory status."
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function openTimelineModal(item: InventoryItem) {
    setTimelineItem(item);
    setTimelineMovements([]);
    setTimelineErrorMessage(null);
    setIsTimelineLoading(true);

    try {
      const data = await apiRequest<InventoryMovement[]>(
        `/api/inventory/items/${item.id}/movements`
      );

      setTimelineMovements(data);
    } catch (error) {
      setTimelineErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load inventory movement history."
      );
    } finally {
      setIsTimelineLoading(false);
    }
  }

  function closeTimelineModal() {
    setTimelineItem(null);
    setTimelineMovements([]);
    setTimelineErrorMessage(null);
    setIsTimelineLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Inventory</h2>
          <p>
            Track furniture inventory, product attributes, location,
            cost, pricing, and movement history.
          </p>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={() => void openAddModal()}
        >
          Add Inventory Item
        </button>
      </div>

      <div className="inventory-summary-grid">
        <div className="summary-card">
          <span className="summary-label">Total Items</span>
          <strong>{inventorySummary.total}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">In Transit</span>
          <strong>{inventorySummary.inTransit}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Local Warehouse</span>
          <strong>{inventorySummary.localWarehouse}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Reserved</span>
          <strong>{inventorySummary.reserved}</strong>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div>
            <h3>Inventory Items</h3>
            <p>
              Showing {filteredInventory.length} of{" "}
              {inventoryItems.length} inventory items.
            </p>
          </div>

          <div className="table-actions">
            <div className="search-group">
              <label htmlFor="inventory-search">Search</label>

              <input
                id="inventory-search"
                type="search"
                placeholder="Search SKU, product, location..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />
            </div>

            <div className="filter-group">
              <label htmlFor="inventory-status-filter">
                Status
              </label>

              <select
                id="inventory-status-filter"
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(
                    event.target.value as InventoryStatusFilter
                  )
                }
              >
                {statusFilterOptions.map((option) => (
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
            Loading inventory from the database...
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="error-message" role="alert">
            <strong>Unable to load inventory.</strong>
            <span>{errorMessage}</span>

            <button
              className="secondary-button"
              type="button"
              onClick={() => void loadInventory()}
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
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Store Type</th>
                  <th>Condition</th>
                  <th>Cost</th>
                  <th>Expected Price</th>
                  <th>Batch</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredInventory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sku}</td>
                    <td>{item.product_name}</td>
                    <td>{item.category}</td>

                    <td>
                      <span
                        className={statusClassNames[item.status]}
                      >
                        {statusLabels[item.status]}
                      </span>
                    </td>

                    <td>{item.location}</td>
                    <td>{formatText(item.store_type)}</td>
                    <td>{formatText(item.condition)}</td>
                    <td>{formatCurrency(item.unit_cost)}</td>
                    <td>
                      {formatCurrency(
                        item.expected_selling_price
                      )}
                    </td>
                    <td>{item.batch_number ?? "-"}</td>

                    <td>
                      <div className="row-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => openStatusModal(item)}
                        >
                          Move Status
                        </button>

                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() =>
                            void openTimelineModal(item)
                          }
                        >
                          View Timeline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredInventory.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="empty-table-message"
                    >
                      No inventory items match the current
                      filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card add-inventory-modal-card">
            <div className="modal-header">
              <div>
                <h3>Add Inventory Item</h3>
                <p>
                  Select an existing product and enter the new
                  inventory record.
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={closeAddModal}
                aria-label="Close add inventory modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {modalErrorMessage && (
                <div className="error-message" role="alert">
                  <strong>Unable to save inventory item.</strong>
                  <span>{modalErrorMessage}</span>
                </div>
              )}

              <div className="form-grid">
                <div className="form-group form-group-full-width">
                  <label htmlFor="inventory-product">
                    Product *
                  </label>

                  <select
                    id="inventory-product"
                    value={inventoryForm.productId}
                    disabled={isProductsLoading}
                    onChange={(event) =>
                      handleProductSelection(event.target.value)
                    }
                  >
                    <option value="">
                      {isProductsLoading
                        ? "Loading products..."
                        : "Select a product"}
                    </option>

                    {products.map((product) => (
                      <option
                        value={product.id}
                        key={product.id}
                      >
                        {product.sku} — {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProduct && (
                  <>
                    <div className="detail-box">
                      <span>SKU</span>
                      <strong>{selectedProduct.sku}</strong>
                    </div>

                    <div className="detail-box">
                      <span>Category</span>
                      <strong>
                        {selectedProduct.category}
                      </strong>
                    </div>

                    <div className="detail-box">
                      <span>Material</span>
                      <strong>
                        {selectedProduct.material}
                      </strong>
                    </div>

                    <div className="detail-box">
                      <span>Color</span>
                      <strong>{selectedProduct.color}</strong>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label htmlFor="inventory-status">
                    Status *
                  </label>

                  <select
                    id="inventory-status"
                    value={inventoryForm.status}
                    onChange={(event) =>
                      handleInventoryStatusSelection(
                        event.target.value as InventoryStatus
                      )
                    }
                  >
                    {statusOptions.map((option) => (
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
                  <label htmlFor="inventory-condition">
                    Condition *
                  </label>

                  <select
                    id="inventory-condition"
                    value={inventoryForm.condition}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        condition: event.target.value,
                      }))
                    }
                  >
                    {conditionOptions.map((option) => (
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
                  <label htmlFor="inventory-location">
                    Location *
                  </label>

                  <input
                    id="inventory-location"
                    type="text"
                    value={inventoryForm.location}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="inventory-store-type">
                    Store Type *
                  </label>

                  <select
                    id="inventory-store-type"
                    value={inventoryForm.storeType}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        storeType: event.target.value,
                      }))
                    }
                  >
                    {storeTypeOptions.map((option) => (
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
                  <label htmlFor="inventory-batch-number">
                    Batch Number
                  </label>

                  <input
                    id="inventory-batch-number"
                    type="text"
                    placeholder="Example: BATCH-2026-001"
                    value={inventoryForm.batchNumber}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        batchNumber: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="inventory-unit-cost">
                    Unit Cost
                  </label>

                  <input
                    id="inventory-unit-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={inventoryForm.unitCost}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        unitCost: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="inventory-selling-price">
                    Expected Selling Price
                  </label>

                  <input
                    id="inventory-selling-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      inventoryForm.expectedSellingPrice
                    }
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        expectedSellingPrice:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="production-start-date">
                    Production Start Date
                  </label>

                  <input
                    id="production-start-date"
                    type="date"
                    value={
                      inventoryForm.productionStartDate
                    }
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        productionStartDate:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="estimated-arrival-date">
                    Estimated Arrival Date
                  </label>

                  <input
                    id="estimated-arrival-date"
                    type="date"
                    value={
                      inventoryForm.estimatedArrivalDate
                    }
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        estimatedArrivalDate:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="actual-arrival-date">
                    Actual Arrival Date
                  </label>

                  <input
                    id="actual-arrival-date"
                    type="date"
                    value={inventoryForm.actualArrivalDate}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        actualArrivalDate:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="received-date">
                    Received Date
                  </label>

                  <input
                    id="received-date"
                    type="date"
                    value={inventoryForm.receivedDate}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        receivedDate: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="inventory-notes">
                  Notes
                </label>

                <textarea
                  id="inventory-notes"
                  rows={4}
                  placeholder="Optional notes for this inventory item."
                  value={inventoryForm.notes}
                  onChange={(event) =>
                    setInventoryForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                disabled={isCreating}
                onClick={closeAddModal}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                type="button"
                disabled={isCreating || isProductsLoading}
                onClick={() =>
                  void handleCreateInventoryItem()
                }
              >
                {isCreating
                  ? "Saving..."
                  : "Save Inventory Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {statusItem && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Update Inventory Status</h3>
                <p>
                  {statusItem.sku} · {statusItem.product_name}
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={closeStatusModal}
                aria-label="Close status update modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {modalErrorMessage && (
                <div className="error-message" role="alert">
                  <strong>
                    Unable to update inventory status.
                  </strong>
                  <span>{modalErrorMessage}</span>
                </div>
              )}

              <div className="detail-row">
                <span>Current Status</span>
                <strong>
                  {statusLabels[statusItem.status]}
                </strong>
              </div>

              <div className="detail-row">
                <span>Current Location</span>
                <strong>{statusItem.location}</strong>
              </div>

              <div className="form-group">
                <label htmlFor="new-inventory-status">
                  New Status
                </label>

                <select
                  id="new-inventory-status"
                  value={statusUpdateForm.status}
                  onChange={(event) =>
                    handleStatusSelection(
                      event.target.value as InventoryStatus
                    )
                  }
                >
                  {statusOptions.map((option) => (
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
                <label htmlFor="new-inventory-location">
                  New Location
                </label>

                <input
                  id="new-inventory-location"
                  type="text"
                  value={statusUpdateForm.location}
                  onChange={(event) =>
                    setStatusUpdateForm((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="new-inventory-store-type">
                  Store Type
                </label>

                <select
                  id="new-inventory-store-type"
                  value={statusUpdateForm.storeType}
                  onChange={(event) =>
                    setStatusUpdateForm((current) => ({
                      ...current,
                      storeType: event.target.value,
                    }))
                  }
                >
                  {storeTypeOptions.map((option) => (
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
                <label htmlFor="movement-reason">
                  Movement Reason
                </label>

                <textarea
                  id="movement-reason"
                  rows={4}
                  placeholder="Example: Moved from warehouse to showroom."
                  value={
                    statusUpdateForm.movementReason
                  }
                  onChange={(event) =>
                    setStatusUpdateForm((current) => ({
                      ...current,
                      movementReason: event.target.value,
                    }))
                  }
                />
              </div>
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
                disabled={isUpdatingStatus}
                onClick={() => void handleUpdateStatus()}
              >
                {isUpdatingStatus
                  ? "Saving..."
                  : "Save Status"}
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
                  {timelineItem.sku} ·{" "}
                  {timelineItem.product_name}
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={closeTimelineModal}
                aria-label="Close inventory movement timeline"
              >
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
                  <span>Status</span>
                  <strong>
                    {statusLabels[timelineItem.status]}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Location</span>
                  <strong>{timelineItem.location}</strong>
                </div>

                <div className="detail-box">
                  <span>Store Type</span>
                  <strong>
                    {formatText(timelineItem.store_type)}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Cost</span>
                  <strong>
                    {formatCurrency(timelineItem.unit_cost)}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Expected Price</span>
                  <strong>
                    {formatCurrency(
                      timelineItem.expected_selling_price
                    )}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Batch Number</span>
                  <strong>
                    {timelineItem.batch_number ?? "-"}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Production Start</span>
                  <strong>
                    {formatDate(
                      timelineItem.production_start_date
                    )}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Estimated Arrival</span>
                  <strong>
                    {formatDate(
                      timelineItem.estimated_arrival_date
                    )}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Actual Arrival</span>
                  <strong>
                    {formatDate(
                      timelineItem.actual_arrival_date
                    )}
                  </strong>
                </div>
              </div>

              {timelineItem.notes && (
                <div className="order-note-box">
                  <span>Notes</span>
                  <p>{timelineItem.notes}</p>
                </div>
              )}

              <div className="section-header">
                <div>
                  <h4>Movement History</h4>
                  <p>
                    Status and location changes recorded for
                    this item.
                  </p>
                </div>
              </div>

              {isTimelineLoading && (
                <div className="page-state-message">
                  Loading movement history...
                </div>
              )}

              {!isTimelineLoading &&
                timelineErrorMessage && (
                  <div
                    className="error-message"
                    role="alert"
                  >
                    <strong>
                      Unable to load movement history.
                    </strong>
                    <span>{timelineErrorMessage}</span>
                  </div>
                )}

              {!isTimelineLoading &&
                !timelineErrorMessage &&
                timelineMovements.length > 0 && (
                  <div className="timeline">
                    {timelineMovements.map((movement) => (
                      <div
                        className="timeline-item"
                        key={movement.id}
                      >
                        <div className="timeline-marker" />

                        <div className="timeline-content">
                          <div className="timeline-topline">
                            <span
                              className={
                                statusClassNames[
                                  movement.to_status
                                ]
                              }
                            >
                              {
                                statusLabels[
                                  movement.to_status
                                ]
                              }
                            </span>

                            <span className="timeline-date">
                              {formatDateTime(
                                movement.created_at
                              )}
                            </span>
                          </div>

                          <p className="timeline-reason">
                            {movement.movement_reason ??
                              "Inventory status updated."}
                          </p>

                          <div className="timeline-meta">
                            <span>
                              From status:{" "}
                              {movement.from_status
                                ? statusLabels[
                                    movement.from_status
                                  ]
                                : "New Record"}
                            </span>

                            <span>
                              To status:{" "}
                              {
                                statusLabels[
                                  movement.to_status
                                ]
                              }
                            </span>

                            <span>
                              From location:{" "}
                              {movement.from_location ?? "-"}
                            </span>

                            <span>
                              To location:{" "}
                              {movement.to_location ?? "-"}
                            </span>

                            <span>
                              Performed by:{" "}
                              {movement.performed_by ??
                                "System"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              {!isTimelineLoading &&
                !timelineErrorMessage &&
                timelineMovements.length === 0 && (
                  <p className="empty-table-message">
                    No movement history was found for this
                    inventory item.
                  </p>
                )}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                onClick={closeTimelineModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryPage;