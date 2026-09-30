import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const frontendRoot = dirname(fileURLToPath(import.meta.url));
const webSourceRoot = resolve(frontendRoot, "src");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, "");
  const apiTarget =
    env.KIMIRO_API_URL?.trim() ||
    `http://127.0.0.1:${env.KIMIRO_API_PORT ?? env.API_PORT ?? "3002"}`;

  return {
    define: {
      "process.env.IS_DEMO": JSON.stringify(env.VITE_IS_DEMO ?? ""),
      "process.env.KIMIRO_BASE_PATH": JSON.stringify(
        env.VITE_KIMIRO_BASE_PATH ?? ""
      ),
      "process.env.NODE_ENV": JSON.stringify(
        mode === "production" ? "production" : "development"
      ),
    },
    envDir: frontendRoot,
    optimizeDeps: {
      include: ["buffer"],
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        { find: "@", replacement: webSourceRoot },
        { find: "buffer", replacement: "buffer/" },
        {
          find: "next/navigation",
          replacement: resolve(frontendRoot, "src/shims/next-navigation.ts"),
        },
        {
          find: "next/link",
          replacement: resolve(frontendRoot, "src/shims/next-link.tsx"),
        },
        {
          find: "next/image",
          replacement: resolve(frontendRoot, "src/shims/next-image.tsx"),
        },
      ],
    },
    server: {
      port: Number(env.KIMIRO_WEB_PORT ?? 5173),
      proxy: {
        "/api": {
          changeOrigin: true,
          target: apiTarget,
          ws: true,
        },
        "/ping": {
          changeOrigin: true,
          target: apiTarget,
        },
      },
    },
  };
});
