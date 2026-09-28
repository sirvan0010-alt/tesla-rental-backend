import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 20000,
    // webhook MOCK + listen on PORT + shared DB — paralelně by se praly
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
