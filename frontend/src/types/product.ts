export type ProductCategory =
  | "Sofa"
  | "Dining Table"
  | "Chair"
  | "Bed"
  | "Cabinet"
  | "Other";

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  material: string;
  color: string;
  size: string;
  defaultPurchaseCost: number;
  defaultSellingPrice: number;
  isActive: boolean;
}