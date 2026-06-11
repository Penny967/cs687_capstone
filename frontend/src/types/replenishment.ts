export interface ActiveModelStatus {
  available: boolean;

  model_run_id: string | null;
  model_name: string | null;
  model_type: string | null;
  target_column: string | null;

  training_row_count: number | null;

  mae: string | null;
  rmse: string | null;
  r2: string | null;

  is_active: boolean | null;
  trained_at: string | null;
}

export interface DemandModelTrainingRequest {
  data_source: string | null;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface DemandModelTrainingResponse {
  model_run_id: string;
  model_name: string;
  model_type: string;
  target_column: string;

  training_row_count: number;
  training_set_row_count: number;
  test_set_row_count: number;

  mae: number;
  rmse: number;
  r2: number;

  model_path: string;
  trained_at: string;

  feature_columns: string[];
  categorical_features: string[];
  numeric_features: string[];

  top_feature_importances: FeatureImportance[];
}

export interface ReplenishmentGenerationRequest {
  demand_period_days: number;
  lead_time_days: number;
  safety_stock_days: number;
  minimum_order_quantity: number;

  include_in_production_as_incoming: boolean;
  include_in_transit_as_incoming: boolean;

  urgent_gap_threshold: number;
  high_priority_threshold: number;
  medium_priority_threshold: number;
}

export interface ReplenishmentGenerationResponse {
  model_run_id: string;

  generated_count: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;

  total_suggested_quantity: number;
  generated_at: string;
}

export type ReplenishmentRiskLevel =
  | "High"
  | "Medium"
  | "Low";

export type ReplenishmentDecision =
  | "Urgent Replenishment"
  | "Consider Replenishment"
  | "Maintain Current Inventory"
  | "Slow Down Replenishment"
  | "Reduce Future Purchasing";

export interface ReplenishmentRecommendation {
  id: string;
  model_run_id: string | null;
  product_id: string;

  sku: string;
  product_name: string;

  category: string | null;
  material: string | null;
  color: string | null;
  location: string | null;
  store_type: string | null;
  season: string | null;

  price: string | null;
  cost: string | null;

  current_inventory: number;
  available_inventory: number;
  incoming_inventory: number;
  inventory_supply: number;

  predicted_period_sales: string | null;
  predicted_daily_sales: string | null;
  forecasted_demand_during_lead_time: string | null;

  average_delivery_days: string | null;
  safety_stock: string | null;
  reorder_point: string | null;
  reorder_gap: string | null;

  predicted_inventory_sales_ratio: string | null;

  suggested_reorder_quantity: number;
  replenishment_priority_score: string | null;

  replenishment_decision: ReplenishmentDecision;
  risk_level: ReplenishmentRiskLevel;
  reason: string | null;

  status: string;
  generated_at: string;
  reviewed_at: string | null;
}