import { resolve } from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

const rootDir = import.meta.dirname;

dotenv.config({ path: resolve(rootDir, ".env.test"), quiet: true });

const alias = { "@": resolve(rootDir, "src") };

const unitEnv = {
  NODE_ENV: "test",
  // Dummy values: unit tests never open a connection, but importing any
  // service reaches env.ts, which requires both variables.
  DATABASE_URL:
    "postgresql://user:pass@localhost:5432/unit-tests-never-connect",
  JWT_SECRET: "unit-test-secret-with-more-than-32-characters",
  JWT_EXPIRES_IN: "1h",
};

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          root: rootDir,
          environment: "node",
          include: ["src/**/__tests__/**/*.test.ts"],
          env: unitEnv,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          root: rootDir,
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/setup/globalSetup.ts"],
          setupFiles: ["tests/setup/integrationSetup.ts"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          // Every file shares the same helpa_test database.
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/__tests__/**",
        "src/**/I*.ts",
        "src/docs/swagger.ts",
        "src/types/**",
        "src/server.ts",
      ],
    },
  },
});
