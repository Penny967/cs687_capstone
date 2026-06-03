export type ProductCategory =
  | "Sofa"
  | "Dining Table"
  | "Chair"
  | "Bed"
  | "Cabinet"
  | "Desk"
  | "TV Stand"
  | "Other";

export type ProductMaterial =
  | "Wood"
  | "Leather"
  | "Fabric"
  | "Metal"
  | "Glass"
  | "Mixed"
  | "Other";

export type ProductColor =
  | "Black"
  | "White"
  | "Gray"
  | "Brown"
  | "Beige"
  | "Blue"
  | "Green"
  | "Red"
  | "Natural"
  | "Other";

export interface Product {
  id: string;
  sku: string;
  name: string;

  category: ProductCategory;
  material: ProductMaterial;
  color: ProductColor;

  size: string;

  /**
   * Default selling price used when no custom order price is provided.
   */
  defaultPrice: number;

  /**
   * Default product cost used when no batch-level cost is provided.
   */
  defaultCost: number;

  isActive: boolean;
}