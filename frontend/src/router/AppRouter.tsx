import { createBrowserRouter, RouterProvider } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import DashboardPage from "../pages/DashboardPage";
import ProductsPage from "../pages/ProductsPage";
import InventoryPage from "../pages/InventoryPage";
import OrdersPage from "../pages/OrdersPage";
import ReplenishmentPage from "../pages/ReplenishmentPage";
import CostProfitPage from "../pages/CostProfitPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "products",
        element: <ProductsPage />,
      },
      {
        path: "inventory",
        element: <InventoryPage />,
      },
      {
        path: "orders",
        element: <OrdersPage />,
      },
      {
        path: "replenishment",
        element: <ReplenishmentPage />,
      },
      {
        path: "cost-profit",
        element: <CostProfitPage />,
      },
    ],
  },
]);

function AppRouter() {
  return <RouterProvider router={router} />;
}

export default AppRouter;