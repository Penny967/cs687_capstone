import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "../api/client";
import type {
  ActiveModelStatus,
  DemandModelTrainingRequest,
  DemandModelTrainingResponse,
  ReplenishmentDecision,
  ReplenishmentGenerationRequest,
  ReplenishmentGenerationResponse,
  ReplenishmentRecommendation,
  ReplenishmentRiskLevel,
} from "../types/replenishment";

type RiskFilter = "all" | ReplenishmentRiskLevel;
type DecisionFilter = "all" | ReplenishmentDecision;

type GenerationFormState = {
  demandPeriodDays: string;
  leadTimeDays: string;
  safetyStockDays: string;
  minimumOrderQuantity: string;

  includeInProduction: boolean;
  includeInTransit: boolean;

  urgentGapThreshold: string;
  highPriorityThreshold: string;
  mediumPriorityThreshold: string;
};

const initialGenerationForm: GenerationFormState = {
  demandPeriodDays: "30",
  leadTimeDays: "60",
  safetyStockDays: "14",
  minimumOrderQuantity: "1",

  includeInProduction: true,
  includeInTransit: true,

  urgentGapThreshold: "5",
  highPriorityThreshold: "0.75",
  mediumPriorityThreshold: "0.35",
};

const riskClassNames: Record<
  ReplenishmentRiskLevel,
  string
> = {
  High: "badge badge-red",
  Medium: "badge badge-orange",
  Low: "badge badge-green",
};

const decisionClassNames: Record<
  ReplenishmentDecision,
  string
> = {
  "Urgent Replenishment": "badge badge-red",
  "Consider Replenishment": "badge badge-orange",
  "Maintain Current Inventory": "badge badge-green",
  "Slow Down Replenishment": "badge badge-yellow",
  "Reduce Future Purchasing": "badge badge-gray",
};

const decisionOptions: ReplenishmentDecision[] = [
  "Urgent Replenishment",
  "Consider Replenishment",
  "Maintain Current Inventory",
  "Slow Down Replenishment",
  "Reduce Future Purchasing",
];

function formatCurrency(
  value: string | number | null
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value ?? 0));
}

function formatNumber(
  value: string | number | null,
  digits = 2
): string {
  const parsedValue = Number(value ?? 0);

  if (!Number.isFinite(parsedValue)) {
    return "-";
  }

  return parsedValue.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatInteger(
  value: string | number | null
): string {
  const parsedValue = Number(value ?? 0);

  if (!Number.isFinite(parsedValue)) {
    return "0";
  }

  return Math.round(parsedValue).toLocaleString("en-US");
}

function formatPercentFromRatio(
  value: string | number | null
): string {
  const parsedValue = Number(value ?? 0);

  if (!Number.isFinite(parsedValue)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(parsedValue);
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

function parseRequiredNumber(
  value: string,
  label: string
): number {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsedValue;
}

function ReplenishmentPage() {
  const [modelStatus, setModelStatus] =
    useState<ActiveModelStatus | null>(null);

  const [recommendations, setRecommendations] = useState<
    ReplenishmentRecommendation[]
  >([]);

  const [selectedRecommendation, setSelectedRecommendation] =
    useState<ReplenishmentRecommendation | null>(null);

  const [riskFilter, setRiskFilter] =
    useState<RiskFilter>("all");

  const [decisionFilter, setDecisionFilter] =
    useState<DecisionFilter>("all");

  const [searchTerm, setSearchTerm] = useState("");

  const [generationForm, setGenerationForm] =
    useState<GenerationFormState>(
      initialGenerationForm
    );

  const [isGenerationModalOpen, setIsGenerationModalOpen] =
    useState(false);

  const [lastTrainingResult, setLastTrainingResult] =
    useState<DemandModelTrainingResponse | null>(null);

  const [lastGenerationResult, setLastGenerationResult] =
    useState<ReplenishmentGenerationResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isTraining, setIsTraining] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [actionErrorMessage, setActionErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  async function loadModelStatus() {
    const data = await apiRequest<ActiveModelStatus>(
      "/api/replenishment/model-status"
    );

    setModelStatus(data);
  }

  async function loadRecommendations() {
    const data = await apiRequest<
      ReplenishmentRecommendation[]
    >(
      "/api/replenishment/recommendations?status=pending&limit=500"
    );

    setRecommendations(data);
  }

  async function loadPageData() {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      await Promise.all([
        loadModelStatus(),
        loadRecommendations(),
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load replenishment information."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPageData();
  }, []);

  const filteredRecommendations = useMemo(() => {
    const normalizedSearch =
      searchTerm.trim().toLowerCase();

    return recommendations.filter((recommendation) => {
      const matchesRisk =
        riskFilter === "all" ||
        recommendation.risk_level === riskFilter;

      const matchesDecision =
        decisionFilter === "all" ||
        recommendation.replenishment_decision ===
          decisionFilter;

      const searchableValues = [
        recommendation.sku,
        recommendation.product_name,
        recommendation.category ?? "",
        recommendation.material ?? "",
        recommendation.color ?? "",
        recommendation.location ?? "",
        recommendation.replenishment_decision,
        recommendation.risk_level,
      ];

      const matchesSearch =
        normalizedSearch === "" ||
        searchableValues.some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        );

      return (
        matchesRisk &&
        matchesDecision &&
        matchesSearch
      );
    });
  }, [
    recommendations,
    riskFilter,
    decisionFilter,
    searchTerm,
  ]);

  const summary = useMemo(() => {
    const highRiskCount = recommendations.filter(
      (item) => item.risk_level === "High"
    ).length;

    const mediumRiskCount = recommendations.filter(
      (item) => item.risk_level === "Medium"
    ).length;

    const totalSuggestedQuantity = recommendations.reduce(
      (sum, item) =>
        sum + item.suggested_reorder_quantity,
      0
    );

    const urgentCount = recommendations.filter(
      (item) =>
        item.replenishment_decision ===
        "Urgent Replenishment"
    ).length;

    return {
      total: recommendations.length,
      highRisk: highRiskCount,
      mediumRisk: mediumRiskCount,
      urgent: urgentCount,
      totalSuggestedQuantity,
    };
  }, [recommendations]);

  async function handleTrainModel() {
    setActionErrorMessage(null);
    setSuccessMessage(null);
    setLastTrainingResult(null);

    const payload: DemandModelTrainingRequest = {
      data_source: "simulated_csv",
    };

    try {
      setIsTraining(true);

      const result =
        await apiRequest<DemandModelTrainingResponse>(
          "/api/replenishment/train-model",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

      setLastTrainingResult(result);

      setSuccessMessage(
        `Demand model trained successfully using ${result.training_row_count} records.`
      );

      await loadModelStatus();
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to train the demand model."
      );
    } finally {
      setIsTraining(false);
    }
  }

  function openGenerationModal() {
    setGenerationForm(initialGenerationForm);
    setActionErrorMessage(null);
    setSuccessMessage(null);
    setIsGenerationModalOpen(true);
  }

  function closeGenerationModal() {
    if (isGenerating) {
      return;
    }

    setIsGenerationModalOpen(false);
    setActionErrorMessage(null);
  }

  async function handleGenerateRecommendations() {
    setActionErrorMessage(null);
    setSuccessMessage(null);
    setLastGenerationResult(null);

    try {
      const payload: ReplenishmentGenerationRequest = {
        demand_period_days: parseRequiredNumber(
          generationForm.demandPeriodDays,
          "Demand period days"
        ),
        lead_time_days: parseRequiredNumber(
          generationForm.leadTimeDays,
          "Lead time days"
        ),
        safety_stock_days: parseRequiredNumber(
          generationForm.safetyStockDays,
          "Safety stock days"
        ),
        minimum_order_quantity: parseRequiredNumber(
          generationForm.minimumOrderQuantity,
          "Minimum order quantity"
        ),
        include_in_production_as_incoming:
          generationForm.includeInProduction,
        include_in_transit_as_incoming:
          generationForm.includeInTransit,
        urgent_gap_threshold: parseRequiredNumber(
          generationForm.urgentGapThreshold,
          "Urgent gap threshold"
        ),
        high_priority_threshold: parseRequiredNumber(
          generationForm.highPriorityThreshold,
          "High priority threshold"
        ),
        medium_priority_threshold: parseRequiredNumber(
          generationForm.mediumPriorityThreshold,
          "Medium priority threshold"
        ),
      };

      setIsGenerating(true);

      const result =
        await apiRequest<ReplenishmentGenerationResponse>(
          "/api/replenishment/generate",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

      setLastGenerationResult(result);

      await loadRecommendations();

      setSuccessMessage(
        `Generated ${result.generated_count} replenishment recommendations.`
      );

      setIsGenerationModalOpen(false);
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate recommendations."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Smart Replenishment</h2>
          <p>
            Use Random Forest demand prediction and
            multi-status inventory data to generate
            explainable replenishment recommendations.
          </p>
        </div>

        <div className="row-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={isTraining || isGenerating}
            onClick={() => void handleTrainModel()}
          >
            {isTraining
              ? "Training Model..."
              : "Train Demand Model"}
          </button>

          <button
            className="primary-button"
            type="button"
            disabled={
              isTraining ||
              isGenerating ||
              !modelStatus?.available
            }
            onClick={openGenerationModal}
          >
            Generate Recommendations
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="success-message" role="status">
          {successMessage}
        </div>
      )}

      {actionErrorMessage && !isGenerationModalOpen && (
        <div className="error-message" role="alert">
          <strong>Action failed.</strong>
          <span>{actionErrorMessage}</span>
        </div>
      )}

      <div className="inventory-summary-grid">
        <div className="summary-card">
          <span className="summary-label">
            Recommendations
          </span>
          <strong>{summary.total}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">
            High Risk
          </span>
          <strong>{summary.highRisk}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">
            Urgent SKUs
          </span>
          <strong>{summary.urgent}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">
            Suggested Units
          </span>
          <strong>
            {summary.totalSuggestedQuantity}
          </strong>
        </div>
      </div>

      <div className="card">
        <div className="section-header">
          <div>
            <h3>Active Demand Model</h3>
            <p>
              Current Random Forest model used for demand
              predictions.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="page-state-message">
            Loading model information...
          </div>
        ) : modelStatus?.available ? (
          <div className="order-detail-grid">
            <div className="detail-box">
              <span>Model Type</span>
              <strong>
                {modelStatus.model_type ?? "-"}
              </strong>
            </div>

            <div className="detail-box">
              <span>Training Rows</span>
              <strong>
                {modelStatus.training_row_count ?? 0}
              </strong>
            </div>

            <div className="detail-box">
              <span>MAE</span>
              <strong>
                {formatNumber(modelStatus.mae, 4)}
              </strong>
            </div>

            <div className="detail-box">
              <span>RMSE</span>
              <strong>
                {formatNumber(modelStatus.rmse, 4)}
              </strong>
            </div>

            <div className="detail-box">
              <span>R²</span>
              <strong>
                {formatNumber(modelStatus.r2, 4)}
              </strong>
            </div>

            <div className="detail-box">
              <span>Trained At</span>
              <strong>
                {formatDateTime(
                  modelStatus.trained_at
                )}
              </strong>
            </div>
          </div>
        ) : (
          <div className="warning-box">
            No active demand model is available. Train the
            model before generating recommendations.
          </div>
        )}

        {lastTrainingResult && (
          <>
            <div className="section-header">
              <div>
                <h4>Latest Training Result</h4>
                <p>
                  Top encoded features from the latest
                  training run.
                </p>
              </div>
            </div>

            <div className="table-scroll-container">
              <table className="data-table compact-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Importance</th>
                  </tr>
                </thead>

                <tbody>
                  {lastTrainingResult.top_feature_importances
                    .slice(0, 10)
                    .map((item) => (
                      <tr key={item.feature}>
                        <td>{item.feature}</td>
                        <td>
                          {formatPercentFromRatio(
                            item.importance
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {lastGenerationResult && (
        <div className="card">
          <div className="section-header">
            <div>
              <h3>Latest Generation Run</h3>
              <p>
                Recommendation summary generated at{" "}
                {formatDateTime(
                  lastGenerationResult.generated_at
                )}
                .
              </p>
            </div>
          </div>

          <div className="order-detail-grid">
            <div className="detail-box">
              <span>Generated</span>
              <strong>
                {lastGenerationResult.generated_count}
              </strong>
            </div>

            <div className="detail-box">
              <span>High Risk</span>
              <strong>
                {lastGenerationResult.high_risk_count}
              </strong>
            </div>

            <div className="detail-box">
              <span>Medium Risk</span>
              <strong>
                {lastGenerationResult.medium_risk_count}
              </strong>
            </div>

            <div className="detail-box">
              <span>Low Risk</span>
              <strong>
                {lastGenerationResult.low_risk_count}
              </strong>
            </div>

            <div className="detail-box">
              <span>Total Suggested Units</span>
              <strong>
                {
                  lastGenerationResult.total_suggested_quantity
                }
              </strong>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-toolbar">
          <div>
            <h3>Replenishment Recommendations</h3>
            <p>
              Showing {filteredRecommendations.length} of{" "}
              {recommendations.length} recommendations.
            </p>
          </div>

          <div className="table-actions">
            <div className="search-group">
              <label htmlFor="replenishment-search">
                Search
              </label>

              <input
                id="replenishment-search"
                type="search"
                placeholder="Search SKU, product, category..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />
            </div>

            <div className="filter-group">
              <label htmlFor="risk-filter">
                Risk
              </label>

              <select
                id="risk-filter"
                value={riskFilter}
                onChange={(event) =>
                  setRiskFilter(
                    event.target.value as RiskFilter
                  )
                }
              >
                <option value="all">
                  All Risk Levels
                </option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="decision-filter">
                Decision
              </label>

              <select
                id="decision-filter"
                value={decisionFilter}
                onChange={(event) =>
                  setDecisionFilter(
                    event.target.value as DecisionFilter
                  )
                }
              >
                <option value="all">
                  All Decisions
                </option>

                {decisionOptions.map((decision) => (
                  <option
                    value={decision}
                    key={decision}
                  >
                    {decision}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="page-state-message">
            Loading replenishment recommendations...
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="error-message" role="alert">
            <strong>
              Unable to load replenishment data.
            </strong>
            <span>{errorMessage}</span>

            <button
              className="secondary-button"
              type="button"
              onClick={() => void loadPageData()}
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
                  <th>Product</th>
                  <th>Risk</th>
                  <th>Decision</th>
                  <th>Predicted Sales</th>
                  <th>Available</th>
                  <th>Incoming</th>
                  <th>Supply</th>
                  <th>Reorder Point</th>
                  <th>Gap</th>
                  <th>Suggested Qty</th>
                  <th>Priority</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecommendations.map(
                  (recommendation) => (
                    <tr key={recommendation.id}>
                      <td>{recommendation.sku}</td>
                      <td>
                        {recommendation.product_name}
                      </td>

                      <td>
                        <span
                          className={
                            riskClassNames[
                              recommendation.risk_level
                            ]
                          }
                        >
                          {recommendation.risk_level}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            decisionClassNames[
                              recommendation
                                .replenishment_decision
                            ]
                          }
                        >
                          {
                            recommendation
                              .replenishment_decision
                          }
                        </span>
                      </td>

                      <td>
                        {formatNumber(
                          recommendation
                            .predicted_period_sales
                        )}
                      </td>

                      <td>
                        {
                          recommendation.available_inventory
                        }
                      </td>

                      <td>
                        {
                          recommendation.incoming_inventory
                        }
                      </td>

                      <td>
                        {
                          recommendation.inventory_supply
                        }
                      </td>

                      <td>
                        {formatNumber(
                          recommendation.reorder_point
                        )}
                      </td>

                      <td>
                        {formatNumber(
                          recommendation.reorder_gap
                        )}
                      </td>

                      <td>
                        {
                          recommendation
                            .suggested_reorder_quantity
                        }
                      </td>

                      <td>
                        {formatPercentFromRatio(
                          recommendation
                            .replenishment_priority_score
                        )}
                      </td>

                      <td>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() =>
                            setSelectedRecommendation(
                              recommendation
                            )
                          }
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  )
                )}

                {filteredRecommendations.length === 0 && (
                  <tr>
                    <td
                      colSpan={13}
                      className="empty-table-message"
                    >
                      No replenishment recommendations match
                      the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isGenerationModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Generate Recommendations</h3>
                <p>
                  Configure the Hybrid Replenishment
                  Algorithm parameters.
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={closeGenerationModal}
                aria-label="Close generation modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {actionErrorMessage && (
                <div
                  className="error-message"
                  role="alert"
                >
                  <strong>
                    Unable to generate recommendations.
                  </strong>
                  <span>{actionErrorMessage}</span>
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="demand-period">
                    Demand Period Days
                  </label>

                  <input
                    id="demand-period"
                    type="number"
                    min="1"
                    value={
                      generationForm.demandPeriodDays
                    }
                    onChange={(event) =>
                      setGenerationForm((current) => ({
                        ...current,
                        demandPeriodDays:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="lead-time">
                    Default Lead Time Days
                  </label>

                  <input
                    id="lead-time"
                    type="number"
                    min="1"
                    value={generationForm.leadTimeDays}
                    onChange={(event) =>
                      setGenerationForm((current) => ({
                        ...current,
                        leadTimeDays:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="safety-stock-days">
                    Safety Stock Days
                  </label>

                  <input
                    id="safety-stock-days"
                    type="number"
                    min="0"
                    value={
                      generationForm.safetyStockDays
                    }
                    onChange={(event) =>
                      setGenerationForm((current) => ({
                        ...current,
                        safetyStockDays:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="minimum-order">
                    Minimum Order Quantity
                  </label>

                  <input
                    id="minimum-order"
                    type="number"
                    min="1"
                    value={
                      generationForm.minimumOrderQuantity
                    }
                    onChange={(event) =>
                      setGenerationForm((current) => ({
                        ...current,
                        minimumOrderQuantity:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="urgent-gap">
                    Urgent Gap Threshold
                  </label>

                  <input
                    id="urgent-gap"
                    type="number"
                    min="0"
                    step="0.1"
                    value={
                      generationForm.urgentGapThreshold
                    }
                    onChange={(event) =>
                      setGenerationForm((current) => ({
                        ...current,
                        urgentGapThreshold:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="high-priority">
                    High Priority Threshold
                  </label>

                  <input
                    id="high-priority"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={
                      generationForm.highPriorityThreshold
                    }
                    onChange={(event) =>
                      setGenerationForm((current) => ({
                        ...current,
                        highPriorityThreshold:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="medium-priority">
                    Medium Priority Threshold
                  </label>

                  <input
                    id="medium-priority"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={
                      generationForm.mediumPriorityThreshold
                    }
                    onChange={(event) =>
                      setGenerationForm((current) => ({
                        ...current,
                        mediumPriorityThreshold:
                          event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={
                      generationForm.includeInProduction
                    }
                    onChange={(event) =>
                      setGenerationForm((current) => ({
                        ...current,
                        includeInProduction:
                          event.target.checked,
                      }))
                    }
                  />
                  Include In Production as incoming inventory
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={
                      generationForm.includeInTransit
                    }
                    onChange={(event) =>
                      setGenerationForm((current) => ({
                        ...current,
                        includeInTransit:
                          event.target.checked,
                      }))
                    }
                  />
                  Include In Transit as incoming inventory
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                disabled={isGenerating}
                onClick={closeGenerationModal}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                type="button"
                disabled={isGenerating}
                onClick={() =>
                  void handleGenerateRecommendations()
                }
              >
                {isGenerating
                  ? "Generating..."
                  : "Generate Recommendations"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRecommendation && (
        <div className="modal-backdrop">
          <div className="modal-card order-detail-modal-card">
            <div className="modal-header">
              <div>
                <h3>Recommendation Details</h3>
                <p>
                  {selectedRecommendation.sku} ·{" "}
                  {
                    selectedRecommendation.product_name
                  }
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={() =>
                  setSelectedRecommendation(null)
                }
                aria-label="Close recommendation details"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="order-detail-grid">
                <div className="detail-box">
                  <span>Risk Level</span>
                  <strong>
                    <span
                      className={
                        riskClassNames[
                          selectedRecommendation.risk_level
                        ]
                      }
                    >
                      {
                        selectedRecommendation.risk_level
                      }
                    </span>
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Decision</span>
                  <strong>
                    {
                      selectedRecommendation
                        .replenishment_decision
                    }
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Category</span>
                  <strong>
                    {selectedRecommendation.category ??
                      "-"}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Material</span>
                  <strong>
                    {selectedRecommendation.material ??
                      "-"}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Color</span>
                  <strong>
                    {selectedRecommendation.color ?? "-"}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Location</span>
                  <strong>
                    {selectedRecommendation.location ??
                      "-"}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Price</span>
                  <strong>
                    {formatCurrency(
                      selectedRecommendation.price
                    )}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Cost</span>
                  <strong>
                    {formatCurrency(
                      selectedRecommendation.cost
                    )}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Predicted Sales</span>
                  <strong>
                    {formatNumber(
                      selectedRecommendation
                        .predicted_period_sales
                    )}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Available Inventory</span>
                  <strong>
                    {
                      selectedRecommendation
                        .available_inventory
                    }
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Incoming Inventory</span>
                  <strong>
                    {
                      selectedRecommendation
                        .incoming_inventory
                    }
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Inventory Supply</span>
                  <strong>
                    {
                      selectedRecommendation
                        .inventory_supply
                    }
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Lead-Time Demand</span>
                  <strong>
                    {formatNumber(
                      selectedRecommendation
                        .forecasted_demand_during_lead_time
                    )}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Safety Stock</span>
                  <strong>
                    {formatNumber(
                      selectedRecommendation.safety_stock
                    )}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Reorder Point</span>
                  <strong>
                    {formatNumber(
                      selectedRecommendation.reorder_point
                    )}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Reorder Gap</span>
                  <strong>
                    {formatNumber(
                      selectedRecommendation.reorder_gap
                    )}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Suggested Quantity</span>
                  <strong>
                    {
                      selectedRecommendation
                        .suggested_reorder_quantity
                    }
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Priority Score</span>
                  <strong>
                    {formatPercentFromRatio(
                      selectedRecommendation
                        .replenishment_priority_score
                    )}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Average Delivery Days</span>
                  <strong>
                    {formatNumber(
                      selectedRecommendation
                        .average_delivery_days
                    )}
                  </strong>
                </div>

                <div className="detail-box">
                  <span>Generated At</span>
                  <strong>
                    {formatDateTime(
                      selectedRecommendation.generated_at
                    )}
                  </strong>
                </div>
              </div>

              <div className="order-note-box">
                <span>Recommendation Explanation</span>
                <p>
                  {selectedRecommendation.reason ??
                    "No explanation was generated."}
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  setSelectedRecommendation(null)
                }
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

export default ReplenishmentPage;