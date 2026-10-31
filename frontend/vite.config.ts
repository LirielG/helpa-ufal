import { resolve } from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * In production the API address must come from VITE_API_URL: there is no
 * fallback domain. Fail the build early instead of shipping a bundle that
 * talks to the wrong server. Only runs on `vite build`; dev keeps its
 * localhost default and Vitest (mode "test") reads .env.test.
 */
function assertApiUrl(mode: string): void {
  const value = loadEnv(mode, import.meta.dirname, "VITE_").VITE_API_URL;
  const fail = (reason: string): never => {
    throw new Error(
      `VITE_API_URL é obrigatória no build de produção (${reason}). ` +
        `Defina-a com o endereço público da API, sem barra no fim, ` +
        `ex.: VITE_API_URL=https://api.exemplo.org npm run build`,
    );
  };
  if (!value) return fail("variável ausente ou vazia");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(`"${value}" não é uma URL válida`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    fail(`"${value}" precisa usar http ou https`);
  }
  if (value.endsWith("/")) {
    fail(`"${value}" não pode terminar com "/"`);
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === "build") assertApiUrl(mode);
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "src"),
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      env: { TZ: "America/Maceio" },
      globals: false,
      passWithNoTests: true,
      include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        reportsDirectory: "coverage",
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/test/**",
          "src/**/__tests__/**",
          "src/main.tsx",
          "src/types/**",
          "src/assets/**",
          "**/*.d.ts",
        ],
      },
    },
  };
});
