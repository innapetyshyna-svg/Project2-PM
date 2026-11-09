import { defineConfig, devices } from "@playwright/test";

// Runs against the Docker container started with scripts/start.*
export default defineConfig({
  testDir: "./tests",
  // All tests share one container and database
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
