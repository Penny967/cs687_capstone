import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "../api/client";
import type { Product } from "../types/product";

function formatCurrency(value: string | number | null): string {
  const parsedValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(parsedValue);
}

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadProducts() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const data = await apiRequest<Product[]>("/api/products?limit=200");

        if (!isCancelled) {
          setProducts(data);
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load products."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isCancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    return Array.from(
      new Set(products.map((product) => product.category))
    ).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "all" ||
        product.category === selectedCategory;

      const matchesSearch =
        normalizedSearch === "" ||
        product.sku.toLowerCase().includes(normalizedSearch) ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch) ||
        product.material.toLowerCase().includes(normalizedSearch) ||
        product.color.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [products, searchTerm, selectedCategory]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Products</h2>
          <p>
            Manage product attributes, pricing, cost, and availability for
            inventory and replenishment analysis.
          </p>
        </div>

        <button className="primary-button" type="button">
          Add Product
        </button>
      </div>

      <div className="inventory-summary-grid">
        <div className="summary-card">
          <span className="summary-label">Total Products</span>
          <strong>{products.length}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Active Products</span>
          <strong>
            {products.filter((product) => product.is_active).length}
          </strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Categories</span>
          <strong>{categories.length}</strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">Displayed Results</span>
          <strong>{filteredProducts.length}</strong>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div>
            <h3>Product Catalog</h3>
            <p>
              Showing {filteredProducts.length} of {products.length} products.
            </p>
          </div>

          <div className="table-actions">
            <div className="search-group">
              <label htmlFor="product-search">Search</label>
              <input
                id="product-search"
                type="search"
                placeholder="Search SKU, product, material..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="product-category-filter">Category</label>
              <select
                id="product-category-filter"
                value={selectedCategory}
                onChange={(event) =>
                  setSelectedCategory(event.target.value)
                }
              >
                <option value="all">All Categories</option>

                {categories.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="page-state-message">
            Loading products from the database...
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="error-message" role="alert">
            <strong>Unable to load products.</strong>
            <span>{errorMessage}</span>
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
                  <th>Material</th>
                  <th>Color</th>
                  <th>Size</th>
                  <th>Default Cost</th>
                  <th>Default Price</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>{product.sku}</td>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{product.material}</td>
                    <td>{product.color}</td>
                    <td>{product.size ?? "-"}</td>
                    <td>{formatCurrency(product.default_cost)}</td>
                    <td>{formatCurrency(product.default_price)}</td>
                    <td>
                      <span
                        className={
                          product.is_active
                            ? "badge badge-green"
                            : "badge badge-gray"
                        }
                      >
                        {product.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="empty-table-message">
                      No products match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductsPage;