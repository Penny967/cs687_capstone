import { Link, Outlet } from "react-router-dom";

function DashboardLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="sidebar-title">Furniture IMS</h1>

        <nav className="nav-menu">
          <Link to="/">Dashboard</Link>
          <Link to="/products">Products</Link>
          <Link to="/inventory">Inventory</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/replenishment">Replenishment</Link>
          <Link to="/cost-profit">Cost & Profit</Link>
        </nav>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;