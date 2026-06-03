import { mockProducts } from "../data/mockProducts";

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function ProductsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Products</h2>
          <p>Manage furniture product information used by inventory, orders, and replenishment analysis.</p>
        </div>

        <button className="primary-button">Add Product</button>
      </div>

      <div className="card">
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
            {mockProducts.map((product) => (
              <tr key={product.id}>
                <td>{product.sku}</td>
                <td>{product.name}</td>
                <td>{product.category}</td>
                <td>{product.material}</td>
                <td>{product.color}</td>
                <td>{product.size}</td>
                <td>{formatCurrency(product.defaultCost)}</td>
                <td>{formatCurrency(product.defaultPrice)}</td>
                <td>
                  <span className={product.isActive ? "badge badge-green" : "badge badge-gray"}>
                    {product.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProductsPage;