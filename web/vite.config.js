import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        cameraTest: resolve(import.meta.dirname, "camera-test.html"),
      },
    },
  },
});
