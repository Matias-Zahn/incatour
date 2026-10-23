import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const usarMocks = env.VITE_USE_MOCKS !== "false";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Con VITE_USE_MOCKS=false, las llamadas a /api van al back real.
      proxy: usarMocks
        ? undefined
        : {
            "/api": { target: "http://localhost:3000", changeOrigin: true },
          },
    },
  };
});
