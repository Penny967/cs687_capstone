import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: "0.0.0.0",
    port: 5173,

    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("error", (error) => {
            console.error("Vite proxy error:", error.message);
          });

          proxy.on("proxyReq", (_proxyReq, request) => {
            console.log(
              "Proxying:",
              request.method,
              request.url
            );
          });
        },
      },
    },
  },
});