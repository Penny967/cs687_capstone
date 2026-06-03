import { mockSalesAnalyticsRecords } from "../data/mockSalesAnalytics";
import type { SalesAnalyticsRecord } from "../types/analytics";

interface ReplenishmentRecommendation {
  sku: string;
  productName: string;
  category: string;
  material: string;
  color: string;
  currentInventory: number;
  totalSales: number;
  averageDeliveryDays: number;
  recommendedQuantity: number;
  reason: string;
  riskLevel: "Low" | "Medium" | "High";
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function groupAnalyticsBySku(records: SalesAnalyticsRecord[]) {
  const grouped = new Map<string, SalesAnalyticsRecord[]>();

  records.forEach((record) => {
    const currentRecords = grouped.get(record.sku) ?? [];
    grouped.set(record.sku, [...currentRecords, record]);
  });

  return grouped;
}

function buildRecommendations(
  records: SalesAnalyticsRecord[]
): ReplenishmentRecommendation[] {
  const groupedRecords = groupAnalyticsBySku(records);

  return Array.from(groupedRecords.entries()).map(([sku, skuRecords]) => {
    const firstRecord = skuRecords[0];

    const totalSales = skuRecords.reduce(
      (sum, record) => sum + record.sales,
      0
    );

    const currentInventory = Math.min(
      ...skuRecords.map((record) => record.inventory)
    );

    const deliveryDayRecords = skuRecords.filter(
      (record) => record.deliveryDays !== null
    );

    const averageDeliveryDays =
      deliveryDayRecords.length > 0
        ? deliveryDayRecords.reduce(
            (sum, record) => sum + (record.deliveryDays ?? 0),
            0
          ) / deliveryDayRecords.length
        : 60;

    const targetStock = Math.ceil(totalSales + averageDeliveryDays / 30);
    const recommendedQuantity = Math.max(0, targetStock - currentInventory);

    let riskLevel: "Low" | "Medium" | "High" = "Low";

    if (recommendedQuantity >= 3 || currentInventory === 0) {
      riskLevel = "High";
    } else if (recommendedQuantity >= 1) {
      riskLevel = "Medium";
    }

    const reason =
      recommendedQuantity > 0
        ? `Sales demand and delivery lead time suggest this SKU may need ${recommendedQuantity} more item(s).`
        : "Current inventory appears sufficient based on available analytics records.";

    return {
      sku,
      productName: firstRecord.productName,
      category: firstRecord.category,
      material: firstRecord.material,
      color: firstRecord.color,
      currentInventory,
      totalSales,
      averageDeliveryDays,
      recommendedQuantity,
      reason,
      riskLevel,
    };
  });
}

function getRiskBadgeClass(riskLevel: ReplenishmentRecommendation["riskLevel"]) {
  if (riskLevel === "High") return "badge badge-red";
  if (riskLevel === "Medium") return "badge badge-orange";
  return "badge badge-green";
}

function ReplenishmentPage() {
  const recommendations = buildRecommendations(mockSalesAnalyticsRecords);

  const highRiskCount = recommendations.filter(
    (item) => item.riskLevel === "High"
  ).length;

  const mediumRiskCount = recommendations.filter(
    (item) => item.riskLevel === "Medium"
  ).length;

  const totalRecommendedQuantity = recommendations.reduce(
    (sum, item) => sum + item.recommendedQuantity,
    0
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Smart Replenishment</h2>
          <p>
            Generate reorder recommendations from sales analytics records,
            current inventory, and delivery lead time.
          </p>
        </div>

        <button className="primary-button">Generate Recommendations</button>
      </div>

      <div className="inventory-summary-grid">
        <div className="summary-card">
          <span className="summary-label">Analytics Records</span>
          <strong>{mockSalesAnalyticsRecords.length}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">High Risk SKUs</span>
          <strong>{highRiskCount}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Medium Risk SKUs</span>
          <strong>{mediumRiskCount}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Recommended Qty</span>
          <strong>{totalRecommendedQuantity}</strong>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3>Replenishment Recommendations</h3>
            <p>
              Recommendations are calculated from sales, inventory, and
              delivery_days generated in analytics records.
            </p>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Category</th>
              <th>Material</th>
              <th>Color</th>
              <th>Inventory</th>
              <th>Total Sales</th>
              <th>Avg Delivery Days</th>
              <th>Recommended Qty</th>
              <th>Risk</th>
            </tr>
          </thead>

          <tbody>
            {recommendations.map((item) => (
              <tr key={item.sku}>
                <td>{item.sku}</td>
                <td>{item.productName}</td>
                <td>{item.category}</td>
                <td>{item.material}</td>
                <td>{item.color}</td>
                <td>{item.currentInventory}</td>
                <td>{item.totalSales}</td>
                <td>{formatNumber(item.averageDeliveryDays)}</td>
                <td>{item.recommendedQuantity}</td>
                <td>
                  <span className={getRiskBadgeClass(item.riskLevel)}>
                    {item.riskLevel}
                  </span>
                </td>
              </tr>
            ))}

            {recommendations.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-table-message">
                  No analytics records are available for replenishment
                  recommendations.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card replenishment-explanation-card">
        <div className="card-header">
          <div>
            <h3>Recommendation Logic</h3>
            <p>Current mock algorithm used for the frontend prototype.</p>
          </div>
        </div>

        <div className="status-list">
          <div className="status-list-item">
            <span>Input Data</span>
            <strong>Sales Analytics Records</strong>
          </div>

          <div className="status-list-item">
            <span>Core Fields</span>
            <strong>sales, inventory, delivery_days</strong>
          </div>

          <div className="status-list-item">
            <span>Product Attributes</span>
            <strong>category, material, color</strong>
          </div>

          <div className="status-list-item">
            <span>Risk Logic</span>
            <strong>Low / Medium / High</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReplenishmentPage;