import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const apiPort = process.env.API_PORT || "8787";

function devApi(): Plugin {
  let api: ChildProcess | undefined;
  const stop = () => {
    api?.kill();
    api = undefined;
  };
  return {
    name: "dev-api",
    apply: "serve",
    configureServer(server) {
      api = spawn(
        fileURLToPath(new URL("./node_modules/.bin/tsx", import.meta.url)),
        ["watch", "--clear-screen=false", "scripts/dev-api.ts"],
        { stdio: "inherit", env: { ...process.env, API_PORT: apiPort } },
      );
      server.httpServer?.on("close", stop);
      process.once("exit", stop);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  build: {
    chunkSizeWarningLimit: 3300,
  },
  server: {
    proxy: {
      "/api": `http://localhost:${apiPort}`,
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
