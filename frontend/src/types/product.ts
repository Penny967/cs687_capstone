export interface Product {
  id: string;
  sku: string;
  name: string;

  category: string;
  material: string;
  color: string;
  size: string | null;

  default_price: string;
  default_cost: string;

  is_active: boolean;

  created_at: string;
  updated_at: string;
}